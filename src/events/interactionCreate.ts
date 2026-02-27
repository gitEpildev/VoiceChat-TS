import type {
  Client,
  ButtonInteraction,
  ModalSubmitInteraction,
  UserSelectMenuInteraction,
  GuildMember,
  VoiceChannel,
  TextChannel,
} from "discord.js";
import { PermissionFlagsBits } from "discord.js";
import { getConfig } from "../services/ConfigService.js";
import {
  getVoiceChannel,
  updateOwner,
  updateLastOwnerSeen,
  syncSideChatPermissions,
} from "../services/VoiceService.js";
import {
  setOwnerPermissions,
  isAdmin,
  isBot,
} from "../services/PermissionService.js";
import { log } from "../services/LoggingService.js";
import {
  buildRenameModal,
  buildLimitModal,
  MODAL_IDS,
} from "../ui/controlPanel.js";
import { validateRename, validateLimit } from "../utils/validators.js";
import { handleCommand } from "../commands/router.js";

const CUSTOM_IDS = [
  "vc:rename",
  "vc:limit",
  "vc:lock",
  "vc:unlock",
  "vc:public",
  "vc:private",
  "vc:transfer",
  "vc:claim",
  "vc:kick",
  "vc:ban",
  "vc:unban",
] as const;

function isControlPanelCustomId(id: string): id is (typeof CUSTOM_IDS)[number] {
  return CUSTOM_IDS.includes(id as (typeof CUSTOM_IDS)[number]);
}

async function getMemberVoiceChannel(
  member: GuildMember
): Promise<VoiceChannel | null> {
  if (!member.voice.channelId) return null;
  const ch = await member.voice.channel;
  return ch?.isVoiceBased() ? (ch as VoiceChannel) : null;
}

async function resolveVoiceContext(interaction: ButtonInteraction | UserSelectMenuInteraction): Promise<{
  voiceChannel: VoiceChannel;
  vc: NonNullable<Awaited<ReturnType<typeof getVoiceChannel>>>;
  config: NonNullable<Awaited<ReturnType<typeof getConfig>>>;
} | null> {
  if (!interaction.guild || !interaction.member) return null;
  const member = interaction.member as GuildMember;
  const voiceChannel = await getMemberVoiceChannel(member);
  if (!voiceChannel) {
    await interaction.reply({
      content: "You must be in a voice channel to use the control panel.",
      ephemeral: true,
    });
    return null;
  }
  const vc = await getVoiceChannel(voiceChannel.id);
  if (!vc) {
    await interaction.reply({
      content: "This voice channel is not managed by the bot.",
      ephemeral: true,
    });
    return null;
  }
  const config = await getConfig(interaction.guildId!);
  if (!config || !config.controlPanelChannelId || interaction.channelId !== config.controlPanelChannelId) {
    return null;
  }
  return { voiceChannel, vc, config };
}

function isOrphaned(vc: { ownerId: string; lastOwnerSeenAt: number }, config: { claimTimeoutSeconds: number }, voiceChannel: VoiceChannel): boolean {
  const ownerInChannel = voiceChannel.members.has(vc.ownerId);
  if (ownerInChannel) return false;
  const elapsed = Date.now() - vc.lastOwnerSeenAt;
  return elapsed >= config.claimTimeoutSeconds * 1000;
}

export function registerInteractionCreate(client: Client): void {
  client.on("interactionCreate", async (interaction) => {
    try {
      if (interaction.isChatInputCommand()) {
        await handleCommand(interaction);
        return;
      }

      if (interaction.isButton() && isControlPanelCustomId(interaction.customId)) {
        const ctx = await resolveVoiceContext(interaction);
        if (!ctx) {
          if (!interaction.replied) {
            await interaction.reply({ content: "Could not resolve voice context.", ephemeral: true }).catch(() => {});
          }
          return;
        }
        const { voiceChannel, vc, config } = ctx;
        const member = interaction.member as GuildMember;
        const isOwner = vc.ownerId === member.id;
        const canClaim = !isOwner && isOrphaned(vc, config, voiceChannel) && voiceChannel.members.has(member.id);

        switch (interaction.customId) {
          case "vc:rename":
            if (!isOwner) {
              await interaction.reply({ content: "Only the channel owner can rename.", ephemeral: true });
              return;
            }
            await interaction.showModal(buildRenameModal());
            return;

          case "vc:limit":
            if (!isOwner) {
              await interaction.reply({ content: "Only the channel owner can set the limit.", ephemeral: true });
              return;
            }
            await interaction.showModal(buildLimitModal());
            return;

          case "vc:lock":
            if (!isOwner) {
              await interaction.reply({ content: "Only the channel owner can lock.", ephemeral: true });
              return;
            }
            await setOwnerPermissions(voiceChannel, vc.ownerId, true);
            await interaction.reply({ content: "Channel locked.", ephemeral: true });
            await log(client, interaction.guildId!, "lock", {
              userId: member.id,
              userName: member.user.username,
              channelId: voiceChannel.id,
              guildName: interaction.guild!.name,
            });
            return;

          case "vc:unlock":
            if (!isOwner) {
              await interaction.reply({ content: "Only the channel owner can unlock.", ephemeral: true });
              return;
            }
            await setOwnerPermissions(voiceChannel, vc.ownerId, false);
            await interaction.reply({ content: "Channel unlocked.", ephemeral: true });
            await log(client, interaction.guildId!, "unlock", {
              userId: member.id,
              userName: member.user.username,
              channelId: voiceChannel.id,
              guildName: interaction.guild!.name,
            });
            return;

          case "vc:public":
            if (!isOwner) {
              await interaction.reply({ content: "Only the channel owner can change privacy.", ephemeral: true });
              return;
            }
            await voiceChannel.permissionOverwrites.edit(interaction.guild!.id, { Connect: true });
            await interaction.reply({ content: "Channel is now public.", ephemeral: true });
            await log(client, interaction.guildId!, "privacy_change", {
              userId: member.id,
              userName: member.user.username,
              channelId: voiceChannel.id,
              guildName: interaction.guild!.name,
              extra: "Public",
            });
            return;

          case "vc:private":
            if (!isOwner) {
              await interaction.reply({ content: "Only the channel owner can change privacy.", ephemeral: true });
              return;
            }
            await voiceChannel.permissionOverwrites.edit(interaction.guild!.id, { Connect: false });
            await interaction.reply({ content: "Channel is now private.", ephemeral: true });
            await log(client, interaction.guildId!, "privacy_change", {
              userId: member.id,
              userName: member.user.username,
              channelId: voiceChannel.id,
              guildName: interaction.guild!.name,
              extra: "Private",
            });
            return;

          case "vc:claim":
            if (!canClaim) {
              await interaction.reply({
                content: "You can only claim when the owner has left for the configured timeout, or left the server.",
                ephemeral: true,
              });
              return;
            }
            await updateOwner(voiceChannel.id, member.id);
            const textChannel = await client.channels.fetch(vc.textChannelId) as TextChannel;
            await setOwnerPermissions(voiceChannel, member.id, false);
            if (textChannel) {
              await syncSideChatPermissions(voiceChannel, textChannel, member.id);
            }
            await interaction.reply({
              content: `You are now the owner of this channel.`,
              ephemeral: true,
            });
            await log(client, interaction.guildId!, "claim_executed", {
              userId: member.id,
              userName: member.user.username,
              channelId: voiceChannel.id,
              guildName: interaction.guild!.name,
            });
            return;

          default:
            await interaction.reply({ content: "Unknown action.", ephemeral: true }).catch(() => {});
        }
        return;
      }

      if (interaction.isModalSubmit()) {
        if (interaction.customId === MODAL_IDS.rename) {
          const name = interaction.fields.getTextInputValue("name");
          const { valid, error } = validateRename(name);
          if (!valid) {
            await interaction.reply({ content: error ?? "Invalid name.", ephemeral: true });
            return;
          }
          const member = interaction.member as GuildMember;
          if (!member.voice.channelId) {
            await interaction.reply({ content: "You must be in a voice channel.", ephemeral: true });
            return;
          }
          const vc = await getVoiceChannel(member.voice.channelId);
          if (!vc || vc.ownerId !== member.id) {
            await interaction.reply({ content: "Only the owner can rename.", ephemeral: true });
            return;
          }
          const voiceChannel = await client.channels.fetch(member.voice.channelId) as VoiceChannel;
          await voiceChannel.setName(name.trim().slice(0, 100));
          await interaction.reply({ content: "Channel renamed.", ephemeral: true });
          return;
        }

        if (interaction.customId === MODAL_IDS.limit) {
          const raw = interaction.fields.getTextInputValue("limit");
          const num = parseInt(raw, 10);
          const { valid, error } = validateLimit(num);
          if (!valid) {
            await interaction.reply({ content: error ?? "Invalid limit.", ephemeral: true });
            return;
          }
          const member = interaction.member as GuildMember;
          const voiceChannel = member.voice.channelId
            ? await client.channels.fetch(member.voice.channelId)
            : null;
          if (!voiceChannel || !voiceChannel.isVoiceBased()) {
            await interaction.reply({ content: "You must be in a voice channel.", ephemeral: true });
            return;
          }
          const vc = await getVoiceChannel(voiceChannel.id);
          if (!vc || vc.ownerId !== member.id) {
            await interaction.reply({ content: "Only the owner can set the limit.", ephemeral: true });
            return;
          }
          await (voiceChannel as VoiceChannel).setUserLimit(num);
          await interaction.reply({ content: `User limit set to ${num}.`, ephemeral: true });
          return;
        }
        return;
      }

      if (interaction.isUserSelectMenu()) {
        if (!["vc:transfer", "vc:kick", "vc:ban", "vc:unban"].includes(interaction.customId)) return;

        const ctx = await resolveVoiceContext(interaction);
        if (!ctx) return;
        const { voiceChannel, vc, config } = ctx;
        const member = interaction.member as GuildMember;
        const targetUser = interaction.users.first();
        if (!targetUser) {
          await interaction.reply({ content: "No user selected.", ephemeral: true });
          return;
        }
        const botUserId = client.user?.id ?? "";
        if (isBot(targetUser.id, botUserId)) {
          await interaction.reply({ content: "Cannot target the bot.", ephemeral: true });
          return;
        }

        const isOwner = vc.ownerId === member.id;
        const targetMember = await interaction.guild!.members.fetch(targetUser.id).catch(() => null);
        if (targetMember && isAdmin(targetMember)) {
          await interaction.reply({ content: "Cannot target admins.", ephemeral: true });
          return;
        }

        switch (interaction.customId) {
          case "vc:transfer":
            if (!isOwner) {
              await interaction.reply({ content: "Only the owner can transfer.", ephemeral: true });
              return;
            }
            if (targetUser.bot) {
              await interaction.reply({ content: "Cannot transfer to a bot.", ephemeral: true });
              return;
            }
            await updateOwner(voiceChannel.id, targetUser.id);
            const textCh = await client.channels.fetch(vc.textChannelId) as TextChannel;
            await setOwnerPermissions(voiceChannel, targetUser.id, false);
            if (textCh) await syncSideChatPermissions(voiceChannel, textCh, targetUser.id);
            await interaction.reply({
              content: `Ownership transferred to ${targetUser}.`,
              ephemeral: true,
            });
            await log(client, interaction.guildId!, "owner_transferred", {
              userId: member.id,
              userName: member.user.username,
              targetUserId: targetUser.id,
              targetUserName: targetUser.username,
              channelId: voiceChannel.id,
              guildName: interaction.guild!.name,
            });
            return;

          case "vc:kick":
            if (!isOwner) {
              await interaction.reply({ content: "Only the owner can kick.", ephemeral: true });
              return;
            }
            const kickTarget = voiceChannel.members.get(targetUser.id);
            if (kickTarget) {
              await kickTarget.voice.disconnect();
              await interaction.reply({ content: `${targetUser} has been kicked.`, ephemeral: true });
              await log(client, interaction.guildId!, "kick", {
                userId: member.id,
                userName: member.user.username,
                targetUserId: targetUser.id,
                targetUserName: targetUser.username,
                channelId: voiceChannel.id,
                guildName: interaction.guild!.name,
              });
            } else {
              await interaction.reply({ content: "User is not in this voice channel.", ephemeral: true });
            }
            return;

          case "vc:ban":
            if (!isOwner) {
              await interaction.reply({ content: "Only the owner can ban.", ephemeral: true });
              return;
            }
            const banTarget = voiceChannel.members.get(targetUser.id);
            if (banTarget) await banTarget.voice.disconnect();
            await voiceChannel.permissionOverwrites.create(targetUser.id, { Connect: false });
            await interaction.reply({ content: `${targetUser} has been banned from this channel.`, ephemeral: true });
            await log(client, interaction.guildId!, "ban", {
              userId: member.id,
              userName: member.user.username,
              targetUserId: targetUser.id,
              targetUserName: targetUser.username,
              channelId: voiceChannel.id,
              guildName: interaction.guild!.name,
            });
            return;

          case "vc:unban":
            if (!isOwner) {
              await interaction.reply({ content: "Only the owner can unban.", ephemeral: true });
              return;
            }
            await voiceChannel.permissionOverwrites.delete(targetUser.id);
            await interaction.reply({ content: `${targetUser} has been unbanned.`, ephemeral: true });
            await log(client, interaction.guildId!, "unban", {
              userId: member.id,
              userName: member.user.username,
              targetUserId: targetUser.id,
              targetUserName: targetUser.username,
              channelId: voiceChannel.id,
              guildName: interaction.guild!.name,
            });
            return;
        }
      }
    } catch (err) {
      console.error("interactionCreate error:", err);
      try {
        if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: "An error occurred.", ephemeral: true });
        }
      } catch {
        /* ignore */
      }
    }
  });
}
