import type { ChatInputCommandInteraction } from "discord.js";
import { query, queryAll } from "../../db/postgres.js";
import { getConfig } from "../../services/ConfigService.js";
import { repairControlPanel } from "../../services/ControlPanelService.js";
import {
  syncSideChatPermissions,
  deleteVoiceChannel,
} from "../../services/VoiceService.js";
import { scheduleDelete } from "../../utils/timers.js";

export async function handleRepair(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const guild = interaction.guild;
  if (!guild) {
    await interaction.reply({ content: "This command must be used in a server.", ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  const config = await getConfig(guild.id);
  if (!config) {
    await interaction.editReply({
      content: "No config found. Run /setup first.",
    });
    return;
  }

  let repaired = 0;
  let removed = 0;

  if (config.categoryId) {
    try {
      await guild.channels.fetch(config.categoryId);
    } catch {
      await interaction.editReply({
        content: "Category no longer exists. Run /setup again to create a fresh setup.",
      });
      return;
    }
  }

  if (config.creatorChannelId) {
    try {
      await guild.channels.fetch(config.creatorChannelId);
    } catch {
      removed++;
    }
  }

  if (config.controlPanelChannelId) {
    try {
      const cpChannel = await guild.channels.fetch(config.controlPanelChannelId);
      if (cpChannel?.isTextBased()) {
        const didRepair = await repairControlPanel(
          cpChannel as import("discord.js").TextChannel,
          config,
          guild.id
        );
        if (didRepair) repaired++;
      }
    } catch {
      removed++;
    }
  }

  const voiceChannels = await queryAll<{ voiceChannelId: string; textChannelId: string; guildId: string; ownerId: string }>(
    `SELECT "voiceChannelId", "textChannelId", "guildId", "ownerId" FROM voice_channels WHERE "guildId" = $1`,
    [guild.id]
  );

  for (const vc of voiceChannels) {
    try {
      const voiceCh = await guild.channels.fetch(vc.voiceChannelId);
      if (!voiceCh) {
        await query(`DELETE FROM voice_channels WHERE "voiceChannelId" = $1`, [vc.voiceChannelId]);
        removed++;
        continue;
      }
      const textCh = await guild.channels.fetch(vc.textChannelId);
      if (!textCh) {
        await deleteVoiceChannel(guild.id, vc.voiceChannelId);
        removed++;
        continue;
      }
      const members = (voiceCh as import("discord.js").VoiceChannel).members;
      await syncSideChatPermissions(
        voiceCh as import("discord.js").VoiceChannel,
        textCh as import("discord.js").TextChannel,
        vc.ownerId
      );
      if (members.size === 0) {
        scheduleDelete(
          vc.voiceChannelId,
          config.deleteDelaySeconds * 1000,
          async () => {
            try {
              const v = await guild.channels.fetch(vc.voiceChannelId);
              const t = await guild.channels.fetch(vc.textChannelId);
              if (v) await v.delete();
              if (t) await t.delete();
            } catch {
              /* already deleted */
            }
            await deleteVoiceChannel(guild.id, vc.voiceChannelId);
          }
        );
      }
    } catch {
      await query(`DELETE FROM voice_channels WHERE "voiceChannelId" = $1`, [vc.voiceChannelId]);
      removed++;
    }
  }

  await interaction.editReply({
    content: `Repair complete. Control panel reposted: ${repaired > 0 ? "Yes" : "No"}. Stale entries removed: ${removed}.`,
  });
}
