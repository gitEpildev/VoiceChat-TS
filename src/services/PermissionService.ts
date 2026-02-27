import {
  type GuildMember,
  type VoiceChannel,
  type TextChannel,
  PermissionFlagsBits,
  ChannelType,
} from "discord.js";

export function isAdmin(member: GuildMember): boolean {
  return member.permissions.has(PermissionFlagsBits.ManageGuild);
}

export function isBot(userId: string, clientUserId: string): boolean {
  return userId === clientUserId;
}

export async function setOwnerPermissions(
  channel: VoiceChannel,
  ownerId: string,
  lock: boolean
): Promise<void> {
  await channel.permissionOverwrites.edit(ownerId, {
    ManageChannels: true,
    MuteMembers: true,
    MoveMembers: true,
    Connect: true,
  });

  await channel.permissionOverwrites.edit(channel.guild.id, {
    Connect: !lock,
  });
}

export async function setSideChatPermissions(
  textChannel: TextChannel,
  voiceChannel: VoiceChannel,
  ownerId: string,
  memberIds: string[],
  adminIds: string[]
): Promise<void> {
  const allIds = new Set([ownerId, ...memberIds, ...adminIds]);

  for (const id of allIds) {
    await textChannel.permissionOverwrites.edit(id, {
      ViewChannel: true,
      SendMessages: true,
    });
  }
}

export async function addSideChatAccess(
  textChannel: TextChannel,
  memberId: string
): Promise<void> {
  await textChannel.permissionOverwrites.edit(memberId, {
    ViewChannel: true,
    SendMessages: true,
  });
}

export async function revokeSideChatAccess(
  textChannel: TextChannel,
  memberId: string
): Promise<void> {
  try {
    await textChannel.permissionOverwrites.delete(memberId);
  } catch {
    // Overwrite may not exist
  }
}
