/**
 * Voice State Update Event - Handles Join/Leave Voice Channels
 *
 * - Joining "Join To Create" -> create room, move user, post control panel
 * - Leaving a user room -> remove from side chat, schedule delete if empty
 * - Joining a user room -> add to side chat, cancel delete timer
 */
import type { VoiceState } from "discord.js";
import type { Client } from "discord.js";
import { getConfig } from "../services/ConfigService.js";

// Prevents duplicate room creation when event fires multiple times
const creationLocks = new Set<string>();

function creationLockKey(guildId: string, userId: string): string {
  return `${guildId}:${userId}`;
}
import {
  getVoiceChannel,
  createVoiceChannel,
  deleteVoiceChannel,
  canCreateChannel,
  cleanupOrphanedChannels,
  updateLastOwnerSeen,
  syncSideChatPermissions,
  addMemberToSideChat,
  removeMemberFromSideChat,
} from "../services/VoiceService.js";
import { scheduleDelete, cancelDelete } from "../utils/timers.js";
import { log } from "../services/LoggingService.js";

export function registerVoiceStateUpdate(client: Client): void {
  client.on("voiceStateUpdate", async (oldState: VoiceState, newState: VoiceState) => {
    try {
      const guildId = newState.guild.id;

      if (newState.channelId === newState.member?.voice.channelId) {
        const vc = await getVoiceChannel(newState.channelId!);
        if (vc && vc.ownerId === newState.member.id) {
          await updateLastOwnerSeen(newState.channelId!, Date.now());
        }
      }

      const config = await getConfig(guildId);
      if (!config || !config.enabled) return;

      if (config.creatorChannelId && newState.channelId === config.creatorChannelId) {
        const member = newState.member;
        if (member && !member.user.bot) {
          const lockKey = creationLockKey(guildId, member.id);
          if (creationLocks.has(lockKey)) {
            return;
          }
          creationLocks.add(lockKey);

          const check = await canCreateChannel(guildId, member.id, config);
          if (!check.allowed) {
            creationLocks.delete(lockKey);
            await member.voice.disconnect();
            try {
              const dm = await member.createDM();
              await dm.send(check.reason ?? "Cannot create channel.");
            } catch {
              if (config.controlPanelChannelId) {
                const ch = await client.channels.fetch(config.controlPanelChannelId).catch(() => null);
                if (ch?.isTextBased() && "send" in ch) {
                  await (ch as import("discord.js").TextChannel).send({
                    content: `${member} ${check.reason ?? "Cannot create channel."}`,
                  });
                }
              }
            }
            return;
          }

          try {
            const guild = newState.guild;
            await cleanupOrphanedChannels(guild, config);
            const { voiceChannel, textChannel } = await createVoiceChannel(
              guild,
              member,
              config
            );

            await log(client, guildId, "channel_created", {
              userId: member.id,
              userName: member.user.username,
              channelId: voiceChannel.id,
              channelName: voiceChannel.name,
              guildName: guild.name,
            });
            await log(client, guildId, "side_chat_created", {
              userId: member.id,
              userName: member.user.username,
              channelId: textChannel.id,
              channelName: textChannel.name,
              guildName: guild.name,
            });
          } finally {
            creationLocks.delete(lockKey);
          }
        }
        return;
      }

      const leftChannelId = oldState.channelId;
      if (leftChannelId) {
        const vc = await getVoiceChannel(leftChannelId);
        if (vc) {
          const textChannel = await client.channels.fetch(vc.textChannelId);

          if (oldState.member && textChannel?.isTextBased()) {
            await removeMemberFromSideChat(
              textChannel as import("discord.js").TextChannel,
              oldState.member.id
            );
          }

          // Use voice state cache for reliable count (voiceStateUpdate fires after cache update)
          const countInChannel = newState.guild.voiceStates.cache.filter(
            (vs) => vs.channelId === leftChannelId
          ).size;
          if (countInChannel === 0) {
            const delayMs = Math.max(1000, (config.deleteDelaySeconds ?? 10) * 1000);
            scheduleDelete(leftChannelId, delayMs, async () => {
              try {
                const v = await client.channels.fetch(leftChannelId);
                const t = await client.channels.fetch(vc.textChannelId);
                if (v) await v.delete();
                if (t) await t.delete();
              } catch {
                /* already deleted */
              }
              await deleteVoiceChannel(guildId, leftChannelId);
              await log(client, guildId, "channel_deleted", {
                channelId: leftChannelId,
                guildName: newState.guild.name,
              });
            });
          }

          if (oldState.member?.id === vc.ownerId) {
            await updateLastOwnerSeen(leftChannelId, Date.now());
          }
        }
      }

      const joinedChannelId = newState.channelId;
      if (joinedChannelId) {
        const vc = await getVoiceChannel(joinedChannelId);
        if (vc && newState.member) {
          cancelDelete(joinedChannelId);
          const textChannel = await client.channels.fetch(vc.textChannelId);
          if (textChannel?.isTextBased()) {
            await addMemberToSideChat(
              textChannel as import("discord.js").TextChannel,
              newState.member.id
            );
          }
          if (newState.member.id === vc.ownerId) {
            await updateLastOwnerSeen(joinedChannelId, Date.now());
          }
        }
      }
    } catch (err) {
      console.error("voiceStateUpdate error:", err);
    }
  });
}
