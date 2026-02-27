import "dotenv/config";
import {
  Client,
  GatewayIntentBits,
  type TextChannel,
  type VoiceChannel,
} from "discord.js";
import { initDb, closeDb, getPool } from "./db/postgres.js";
import { getConfig, getGuildIds } from "./services/ConfigService.js";
import { repairControlPanel } from "./services/ControlPanelService.js";
import {
  deleteVoiceChannel,
  syncSideChatPermissions,
} from "./services/VoiceService.js";
import { scheduleDelete } from "./utils/timers.js";
import { registerVoiceStateUpdate } from "./events/voiceStateUpdate.js";
import { registerInteractionCreate } from "./events/interactionCreate.js";

const token = process.env.BOT_TOKEN;
if (!token) {
  console.error("BOT_TOKEN is required.");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
  ],
});

async function runRecovery(): Promise<void> {
  const guildIds = await getGuildIds();
  for (const guildId of guildIds) {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) continue;

    const config = await getConfig(guildId);
    if (!config) continue;

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
          await deleteVoiceChannel(guildId, row.voiceChannelId);
          continue;
        }
        if (!textCh) {
          await deleteVoiceChannel(guildId, row.voiceChannelId);
          continue;
        }

        const vc = voiceCh as VoiceChannel;
        const members = vc.members;

        await syncSideChatPermissions(
          vc,
          textCh as TextChannel,
          row.ownerId
        );

        if (members.size === 0) {
          scheduleDelete(
            row.voiceChannelId,
            config.deleteDelaySeconds * 1000,
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

client.once("ready", async () => {
  console.log(`Logged in as ${client.user?.tag}`);
  try {
    await runRecovery();
    console.log("Startup recovery complete.");
  } catch (err) {
    console.error("Recovery error:", err);
  }
});

registerVoiceStateUpdate(client);
registerInteractionCreate(client);

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

process.on("SIGINT", async () => {
  await client.destroy();
  await closeDb();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await client.destroy();
  await closeDb();
  process.exit(0);
});

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
