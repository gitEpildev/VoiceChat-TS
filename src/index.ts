/**
 * VoiceChat-TS Bot - Main Entry Point
 *
 * This file starts the Discord bot, connects to the database,
 * registers event handlers, and runs startup recovery.
 * All voice automation (create, delete, move users) is driven from here.
 */

// Load environment variables from .env file (BOT_TOKEN, DATABASE_URL, etc.)
import "dotenv/config";

import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  type TextChannel,
  type VoiceChannel,
} from "discord.js";
import { commands } from "./commands/definitions.js";
import { initDb, closeDb, getPool } from "./db/postgres.js";
import { getConfig, getGuildIds } from "./services/ConfigService.js";
import {
  repairControlPanel,
  ensureRoomControlPanel,
} from "./services/ControlPanelService.js";
import {
  deleteVoiceChannel,
  syncSideChatPermissions,
  cleanupOrphanedChannels,
} from "./services/VoiceService.js";
import { scheduleDelete } from "./utils/timers.js";
import { registerVoiceStateUpdate } from "./events/voiceStateUpdate.js";
import { registerInteractionCreate } from "./events/interactionCreate.js";

// Bot token from environment - required to connect to Discord
const token = process.env.BOT_TOKEN;
if (!token) {
  console.error("BOT_TOKEN is required.");
  process.exit(1);
}

// Create the Discord client with required intents:
// - Guilds: servers, channels
// - GuildMembers: member list
// - GuildVoiceStates: who is in which voice channel
// - GuildMessages: for slash command responses
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
  ],
});

/**
 * Run recovery on bot startup: fix orphaned channels, repair control panels,
 * re-schedule delete timers for empty rooms (timers are lost on restart).
 */
async function runRecovery(): Promise<void> {
  // Get all guild IDs that have config (i.e. have run /setup)
  const guildIds = await getGuildIds();

  for (const guildId of guildIds) {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) continue; // Guild not in cache (bot left?)

    const config = await getConfig(guildId);
    if (!config) continue;

    // Remove channels that exist in Discord but not in our DB
    try {
      await cleanupOrphanedChannels(guild, config);
    } catch {
      /* ignore errors */
    }

    // If using a shared control panel channel, repair it
    if (config.controlPanelChannelId) {
      try {
        const channel = await guild.channels.fetch(config.controlPanelChannelId);
        if (channel?.isTextBased()) {
          await repairControlPanel(
            channel as TextChannel,
            config,
            guildId
          );
        }
      } catch {
        /* channel may not exist */
      }
    }

    // Load all user-created voice rooms for this guild
    const { rows } = await getPool().query<{
      voiceChannelId: string;
      textChannelId: string;
      guildId: string;
      ownerId: string;
    }>(
      `SELECT "voiceChannelId", "textChannelId", "guildId", "ownerId" FROM voice_channels WHERE "guildId" = $1`,
      [guildId]
    );

    for (const row of rows) {
      try {
        const voiceCh = await guild.channels.fetch(row.voiceChannelId);
        const textCh = await guild.channels.fetch(row.textChannelId);

        if (!voiceCh) {
          // Voice channel was deleted - remove from DB
          await deleteVoiceChannel(guildId, row.voiceChannelId);
          continue;
        }
        if (!textCh) {
          // Text channel was deleted - remove whole room from DB
          await deleteVoiceChannel(guildId, row.voiceChannelId);
          continue;
        }

        // Ensure each room's text channel has a control panel (repost if missing)
        const botUserId = client.user?.id ?? "";
        if (botUserId && textCh.isTextBased()) {
          await ensureRoomControlPanel(
            textCh as TextChannel,
            config,
            botUserId
          ).catch(() => {});
        }

        const vc = voiceCh as VoiceChannel;

        // Sync who can see the side chat based on who's in the voice channel
        await syncSideChatPermissions(
          vc,
          textCh as TextChannel,
          row.ownerId
        );

        // If voice channel is empty, schedule it for deletion (timers don't persist across restarts)
        const countInChannel = guild.voiceStates.cache.filter(
          (vs) => vs.channelId === row.voiceChannelId
        ).size;
        if (countInChannel === 0) {
          const delayMs = Math.max(1000, (config.deleteDelaySeconds ?? 10) * 1000);
          scheduleDelete(
            row.voiceChannelId,
            delayMs,
            async () => {
              try {
                const v = await guild.channels.fetch(row.voiceChannelId);
                const t = await guild.channels.fetch(row.textChannelId);
                if (v) await v.delete();
                if (t) await t.delete();
              } catch {
                /* already deleted */
              }
              await deleteVoiceChannel(guildId, row.voiceChannelId);
            }
          );
        }
      } catch {
        await deleteVoiceChannel(guildId, row.voiceChannelId);
      }
    }
  }
}

// When the bot is ready (connected to Discord)
client.once("ready", async () => {
  console.log(`Logged in as ${client.user?.tag}`);

  const clientId = client.user?.id;
  const token = process.env.BOT_TOKEN;
  if (clientId && token) {
    try {
      const rest = new REST({ version: "10" }).setToken(token);
      // Clear global commands (we use guild-specific)
      await rest.put(Routes.applicationCommands(clientId), { body: [] });
      // Deploy slash commands to each server the bot is in
      for (const [guildId, guild] of client.guilds.cache) {
        try {
          await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
            body: commands,
          });
          console.log(`Commands deployed to guild: ${guild.name} (${guildId})`);
        } catch (e) {
          console.error(`Failed to deploy commands to ${guild.name}:`, e);
        }
      }
    } catch (err) {
      console.error("Command deployment error:", err);
    }
  }

  try {
    await runRecovery();
    console.log("Startup recovery complete.");
  } catch (err) {
    console.error("Recovery error:", err);
  }
});

// Register event handlers
registerVoiceStateUpdate(client);   // Handles join/leave voice, create room, auto-delete
registerInteractionCreate(client);  // Handles slash commands and button/select interactions

async function main(): Promise<void> {
  await initDb();

  try {
    await client.login(token);
  } catch (err) {
    console.error("Login failed:", err);
    await closeDb();
    process.exit(1);
  }
}

// Graceful shutdown on Ctrl+C
process.on("SIGINT", async () => {
  await client.destroy();
  await closeDb();
  process.exit(0);
});

// Graceful shutdown on Docker/system stop
process.on("SIGTERM", async () => {
  await client.destroy();
  await closeDb();
  process.exit(0);
});

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
