/**
 * Voice Service - Core Logic for User Voice Rooms
 *
 * Creates voice + text channel pairs, checks permissions, moves users,
 * manages side chat access, and handles channel lifecycle.
 */
import {
  type Guild,
  type GuildMember,
  type VoiceChannel,
  type TextChannel,
  ChannelType,
  PermissionFlagsBits,
} from "discord.js";
import { postControlPanel } from "./ControlPanelService.js";
import { query, queryOne, queryAll } from "../db/postgres.js";
import type { GuildConfig } from "../db/postgres.js";
import { applyNameTemplate } from "../utils/template.js";
import {
  setOwnerPermissions,
  setSideChatPermissions,
  addSideChatAccess,
  revokeSideChatAccess,
  isAdmin,
} from "./PermissionService.js";

export interface VoiceChannelRow {
  voiceChannelId: string;
  guildId: string;
  textChannelId: string;
  ownerId: string;
  createdAt: number;
  lastOwnerSeenAt: number;
}

export async function getVoiceChannel(
  voiceChannelId: string
): Promise<VoiceChannelRow | null> {
  return queryOne<VoiceChannelRow>(
    `SELECT * FROM voice_channels WHERE "voiceChannelId" = $1`,
    [voiceChannelId]
  );
}

export async function getVoiceChannelByTextChannelId(
  textChannelId: string
): Promise<VoiceChannelRow | null> {
  return queryOne<VoiceChannelRow>(
    `SELECT * FROM voice_channels WHERE "textChannelId" = $1`,
    [textChannelId]
  );
}

export async function getChannelsByOwner(
  guildId: string,
  ownerId: string
): Promise<number> {
  const result = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM voice_channels WHERE "guildId" = $1 AND "ownerId" = $2`,
    [guildId, ownerId]
  );
  return result ? parseInt(result.count, 10) : 0;
}

export async function cleanupOrphanedChannels(
  guild: Guild,
  config: GuildConfig
): Promise<number> {
  if (!config.categoryId) return 0;
  const category = await guild.channels.fetch(config.categoryId).catch(() => null);
  if (!category || category.type !== ChannelType.GuildCategory) return 0;

  const rows = await queryAll<{ voiceChannelId: string; textChannelId: string }>(
    `SELECT "voiceChannelId", "textChannelId" FROM voice_channels WHERE "guildId" = $1`,
    [guild.id]
  );
  const knownIds = new Set<string>();
  for (const r of rows) {
    knownIds.add(r.voiceChannelId);
    knownIds.add(r.textChannelId);
  }
  knownIds.add(config.creatorChannelId ?? "");
  knownIds.add(config.controlPanelChannelId ?? "");

  const children = guild.channels.cache.filter((c) => c.parentId === config.categoryId);
  let cleaned = 0;
  for (const [, ch] of children) {
    if (knownIds.has(ch.id)) continue;
    try {
      await ch.delete();
      cleaned++;
    } catch {
      /* ignore */
    }
  }
  return cleaned;
}

export async function canCreateChannel(
  guildId: string,
  userId: string,
  config: GuildConfig
): Promise<{ allowed: boolean; reason?: string }> {
  const count = await getChannelsByOwner(guildId, userId);
  if (count >= config.maxChannelsPerUser) {
    return {
      allowed: false,
      reason: `You can only have up to ${config.maxChannelsPerUser} active channel(s).`,
    };
  }

  const cooldown = await queryOne<{ lastCreatedAt: string }>(
    `SELECT "lastCreatedAt" FROM cooldowns WHERE "guildId" = $1 AND "userId" = $2`,
    [guildId, userId]
  );

  if (cooldown) {
    const elapsed = Date.now() - parseInt(cooldown.lastCreatedAt, 10);
    const required = config.cooldownSeconds * 1000;
    if (elapsed < required) {
      const remaining = Math.ceil((required - elapsed) / 1000);
      return {
        allowed: false,
        reason: `Please wait ${remaining} seconds before creating another channel.`,
      };
    }
  }

  return { allowed: true };
}

export async function createVoiceChannel(
  guild: Guild,
  member: GuildMember,
  config: GuildConfig
): Promise<{ voiceChannel: VoiceChannel; textChannel: TextChannel }> {
  const categoryId = config.categoryId!;
  const channels = guild.channels;
  const category = await channels.fetch(categoryId);
  if (!category || category.type !== ChannelType.GuildCategory) {
    throw new Error("Category not found");
  }

  const name = applyNameTemplate(
    config.nameTemplate,
    member.user.username
  ).slice(0, 100);
  const voiceName = name;
  const textName = `💬 ${member.user.username}`.slice(0, 100);

  const voiceChannel = await channels.create({
    name: voiceName,
    type: ChannelType.GuildVoice,
    parent: categoryId,
    userLimit: 0,
  });

  const textChannel = await channels.create({
    name: textName,
    type: ChannelType.GuildText,
    parent: categoryId,
    permissionOverwrites: [
      { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: member.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
    ],
  });

  const now = Date.now();

  await setOwnerPermissions(voiceChannel, member.id, false);

  const voiceMembers = voiceChannel.members;
  const memberIds = Array.from(voiceMembers.keys());
  const adminIds = memberIds.filter((id) => {
    const m = voiceMembers.get(id);
    return m && isAdmin(m);
  });

  await setSideChatPermissions(
    textChannel,
    voiceChannel,
    member.id,
    [],
    adminIds
  );

  await query(
    `INSERT INTO voice_channels ("voiceChannelId", "guildId", "textChannelId", "ownerId", "createdAt", "lastOwnerSeenAt")
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [voiceChannel.id, guild.id, textChannel.id, member.id, now, now]
  );

  await query(
    `INSERT INTO cooldowns ("guildId", "userId", "lastCreatedAt") VALUES ($1, $2, $3)
     ON CONFLICT ("guildId", "userId") DO UPDATE SET "lastCreatedAt" = $3`,
    [guild.id, member.id, now]
  );

  // Move user into the new room BEFORE posting control panel (so move succeeds even if panel fails)
  try {
    await guild.members.edit(member.id, {
      channel: voiceChannel.id,
      reason: "Auto-move to new voice room",
    });
  } catch (e) {
    console.error("Failed to move user to new VC:", e);
  }

  try {
    await postControlPanel(textChannel, { ...config, guildId: guild.id });
  } catch (e) {
    console.error("Failed to post control panel (room still created):", e);
  }

  return { voiceChannel, textChannel };
}

export async function deleteVoiceChannel(
  guildId: string,
  voiceChannelId: string
): Promise<void> {
  await query(`DELETE FROM voice_channels WHERE "voiceChannelId" = $1`, [
    voiceChannelId,
  ]);
}

export async function updateOwner(
  voiceChannelId: string,
  newOwnerId: string
): Promise<void> {
  const now = Date.now();
  await query(
    `UPDATE voice_channels SET "ownerId" = $2, "lastOwnerSeenAt" = $3 WHERE "voiceChannelId" = $1`,
    [voiceChannelId, newOwnerId, now]
  );
}

export async function updateLastOwnerSeen(
  voiceChannelId: string,
  timestamp: number
): Promise<void> {
  await query(
    `UPDATE voice_channels SET "lastOwnerSeenAt" = $2 WHERE "voiceChannelId" = $1`,
    [voiceChannelId, timestamp]
  );
}

export async function getOrphanedVoiceChannels(
  config: GuildConfig
): Promise<VoiceChannelRow[]> {
  const rows = await queryAll<VoiceChannelRow>(
    `SELECT * FROM voice_channels WHERE "guildId" = $1`,
    [config.guildId]
  );

  const now = Date.now();
  const threshold = config.claimTimeoutSeconds * 1000;

  return rows.filter((row) => {
    const elapsed = now - row.lastOwnerSeenAt;
    return elapsed >= threshold;
  });
}

export async function syncSideChatPermissions(
  voiceChannel: VoiceChannel,
  textChannel: TextChannel,
  ownerId: string
): Promise<void> {
  const memberIds = Array.from(voiceChannel.members.keys());
  const adminIds = memberIds.filter((id) => {
    const m = voiceChannel.members.get(id);
    return m && isAdmin(m);
  });

  await setSideChatPermissions(textChannel, voiceChannel, ownerId, memberIds, adminIds);
}

export async function addMemberToSideChat(
  textChannel: TextChannel,
  memberId: string
): Promise<void> {
  await addSideChatAccess(textChannel, memberId);
}

export async function removeMemberFromSideChat(
  textChannel: TextChannel,
  memberId: string
): Promise<void> {
  await revokeSideChatAccess(textChannel, memberId);
}
