/**
 * Permission Service - Admin Checks and Channel Permission Overwrites
 *
 * - canRunAdminCommand: server owner or BOT_OWNER
 * - setOwnerPermissions: give room owner lock/unlock, mute, move
 * - setSideChatPermissions: who can see the room's text channel
 */
import {
  type Guild,
  type GuildMember,
  type VoiceChannel,
  type TextChannel,
  PermissionFlagsBits,
} from "discord.js";

/** Bot owners from BOT_OWNER env (comma-separated user IDs). Can use admin commands in any server. */
export function getBotOwnerIds(): string[] {
  const raw = process.env.BOT_OWNER ?? "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isBotOwner(userId: string): boolean {
  return getBotOwnerIds().includes(userId);
}

/** True if the user is the actual owner of the Discord server (guild). */
export function isGuildOwner(guild: Guild, userId: string): boolean {
  return guild.ownerId === userId;
}

/** True if the user may run admin commands: bot owner or server owner. */
export function canRunAdminCommand(guild: Guild | null, userId: string): boolean {
  if (!guild) return false;
  return isBotOwner(userId) || isGuildOwner(guild, userId);
}

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
