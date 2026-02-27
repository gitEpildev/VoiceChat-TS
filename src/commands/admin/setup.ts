/**
 * /setup handler - Creates category, Join To Create channel, and control panel.
 * Tears down existing setup first if present.
 */
import type { ChatInputCommandInteraction } from "discord.js";
import { ChannelType } from "discord.js";
import { query, queryAll } from "../../db/postgres.js";
import { getConfig, upsertConfigFull } from "../../services/ConfigService.js";
import { deleteVoiceChannel } from "../../services/VoiceService.js";
import { cancelDelete } from "../../utils/timers.js";

async function teardownExistingSetup(
  guild: import("discord.js").Guild,
  existing: { categoryId: string | null; creatorChannelId: string | null; controlPanelChannelId: string | null }
): Promise<void> {
  const rows = await queryAll<{ voiceChannelId: string; textChannelId: string }>(
    `SELECT "voiceChannelId", "textChannelId" FROM voice_channels WHERE "guildId" = $1`,
    [guild.id]
  );

  for (const row of rows) {
    cancelDelete(row.voiceChannelId);
    try {
      const vc = await guild.channels.fetch(row.voiceChannelId);
      if (vc) await vc.delete();
    } catch {
      /* already deleted */
    }
    try {
      const tc = await guild.channels.fetch(row.textChannelId);
      if (tc) await tc.delete();
    } catch {
      /* already deleted */
    }
    await deleteVoiceChannel(guild.id, row.voiceChannelId);
  }

  await query(`DELETE FROM cooldowns WHERE "guildId" = $1`, [guild.id]);

  const toDelete = [
    existing.controlPanelChannelId,
    existing.creatorChannelId,
    existing.categoryId,
  ].filter((id): id is string => !!id);

  for (const id of toDelete) {
    try {
      const ch = await guild.channels.fetch(id);
      if (ch) await ch.delete();
    } catch {
      /* already deleted */
    }
  }
}

export async function handleSetup(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const guild = interaction.guild;
  if (!guild) {
    await interaction.reply({ content: "This command must be used in a server.", ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  const existing = await getConfig(guild.id);
  if (existing?.categoryId) {
    try {
      const categoryExists = await guild.channels.fetch(existing.categoryId).catch(() => null);
      if (categoryExists) {
        await teardownExistingSetup(guild, existing);
      } else {
        await query(`DELETE FROM voice_channels WHERE "guildId" = $1`, [guild.id]);
        await query(`DELETE FROM cooldowns WHERE "guildId" = $1`, [guild.id]);
      }
      await query(
        `UPDATE guild_config SET "categoryId" = NULL, "creatorChannelId" = NULL, "controlPanelChannelId" = NULL, "controlPanelMessageId" = NULL WHERE "guildId" = $1`,
        [guild.id]
      );
    } catch (err) {
      console.error("Teardown error:", err);
      await interaction.editReply({
        content: `Failed to remove old setup: ${err instanceof Error ? err.message : "Unknown error"}`,
      });
      return;
    }
  }

  try {
    const category = await guild.channels.create({
      name: "🔊 Join To Create",
      type: ChannelType.GuildCategory,
    });

    const creatorChannel = await guild.channels.create({
      name: "🎤 Join To Create",
      type: ChannelType.GuildVoice,
      parent: category.id,
    });

    await upsertConfigFull(guild.id, {
      enabled: 1,
      categoryId: category.id,
      creatorChannelId: creatorChannel.id,
      controlPanelChannelId: null,
      controlPanelMessageId: null,
      logChannelId: existing?.logChannelId ?? null,
      nameTemplate: existing?.nameTemplate ?? "{username}'s Room",
      brandColor: existing?.brandColor ?? "#5865F2",
      cooldownSeconds: existing?.cooldownSeconds ?? 60,
      deleteDelaySeconds: existing?.deleteDelaySeconds ?? 10,
      claimTimeoutSeconds: existing?.claimTimeoutSeconds ?? 120,
      maxChannelsPerUser: existing?.maxChannelsPerUser ?? 1,
    });

    const logNote = existing?.logChannelId ? "" : "\n\nUse `/setlogchannel` to configure logging.";
    await interaction.editReply({
      content: `✅ **Setup complete!** Old setup removed and recreated.\n\n🔊 **Category:** ${category}\n🎤 **Creator channel:** ${creatorChannel}\n\nJoin the creator channel to create your voice room. Each room gets a private chat with controls.${logNote}`,
    });
  } catch (err) {
    console.error("Setup error:", err);
    const msg = err instanceof Error ? err.message : "Unknown error";
    await interaction.editReply({
      content: `❌ **Setup failed:** ${msg}\n\nIf you see "Missing Permissions", re-invite the bot with Administrator.`,
    }).catch(() => {});
  }
}
