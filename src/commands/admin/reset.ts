import type { ChatInputCommandInteraction } from "discord.js";
import { ChannelType } from "discord.js";
import { query, queryAll } from "../../db/postgres.js";
import { getConfig, upsertConfigFull } from "../../services/ConfigService.js";
import { deleteVoiceChannel } from "../../services/VoiceService.js";
import { cancelDelete } from "../../utils/timers.js";

export async function handleReset(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const guild = interaction.guild;
  if (!guild) {
    await interaction.reply({ content: "This command must be used in a server.", ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    const existing = await getConfig(guild.id);

    const rows = await queryAll<{ voiceChannelId: string; textChannelId: string }>(
      `SELECT "voiceChannelId", "textChannelId" FROM voice_channels WHERE "guildId" = $1`,
      [guild.id]
    );

    let deleted = 0;
    for (const row of rows) {
      cancelDelete(row.voiceChannelId);
      try {
        const vc = await guild.channels.fetch(row.voiceChannelId);
        if (vc) {
          await vc.delete();
          deleted++;
        }
      } catch {
        /* already deleted */
      }
      try {
        const tc = await guild.channels.fetch(row.textChannelId);
        if (tc) {
          await tc.delete();
          deleted++;
        }
      } catch {
        /* already deleted */
      }
      await deleteVoiceChannel(guild.id, row.voiceChannelId);
    }

    await query(`DELETE FROM cooldowns WHERE "guildId" = $1`, [guild.id]);

    for (const id of [
      existing?.controlPanelChannelId,
      existing?.creatorChannelId,
      existing?.categoryId,
    ].filter((x): x is string => !!x)) {
      try {
        const ch = await guild.channels.fetch(id);
        if (ch) await ch.delete();
      } catch {
        /* already deleted */
      }
    }

    await query(
      `UPDATE guild_config SET "categoryId" = NULL, "creatorChannelId" = NULL, "controlPanelChannelId" = NULL, "controlPanelMessageId" = NULL WHERE "guildId" = $1`,
      [guild.id]
    );

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
      deleteDelaySeconds: 10,
      claimTimeoutSeconds: existing?.claimTimeoutSeconds ?? 120,
      maxChannelsPerUser: existing?.maxChannelsPerUser ?? 1,
    });

    await interaction.editReply({
      content: `✅ **Full reset complete!**\n\nRemoved ${deleted} old channels. Fresh setup created:\n\n🔊 **Category:** ${category}\n🎤 **Creator channel:** ${creatorChannel}\n\n• Delete delay: **10 seconds** (rooms auto-delete when empty)\n• Join the creator channel to create your room\n• Control panel is in each room's text channel`,
    });
  } catch (err) {
    console.error("Reset error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    await interaction.editReply({
      content: `❌ **Reset failed:** ${msg}\n\nIf you see "Missing Permissions", re-invite the bot with Administrator: \`https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=8&scope=bot%20applications.commands\``,
    }).catch(() => {});
  }
}
