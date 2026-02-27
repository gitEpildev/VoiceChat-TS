/**
 * Control Panel Service - Post and Repair Control Panel Messages
 *
 * Each room's text channel gets an embed + buttons (Rename, Lock, Kick, etc.).
 * This service posts the panel and can repair it if the message was deleted.
 */
import type { TextChannel } from "discord.js";
import type { GuildConfig } from "../db/postgres.js";
import {
  buildControlPanelEmbed,
  buildControlPanelComponents,
} from "../ui/controlPanel.js";
import { upsertConfig } from "./ConfigService.js";

export async function postControlPanel(
  channel: TextChannel,
  config: GuildConfig
): Promise<string> {
  const embed = buildControlPanelEmbed(config);
  const components = buildControlPanelComponents();
  const message = await channel.send({
    embeds: [embed],
    components,
  });
  return message.id;
}

export async function repairControlPanel(
  channel: TextChannel,
  config: GuildConfig,
  guildId: string
): Promise<boolean> {
  if (!config.controlPanelMessageId) {
    const messageId = await postControlPanel(channel, config);
    await upsertConfig(guildId, { controlPanelMessageId: messageId });
    return true;
  }

  try {
    const message = await channel.messages.fetch(config.controlPanelMessageId);
    if (!message) throw new Error("Message not found");
    return false;
  } catch {
    const messageId = await postControlPanel(channel, config);
    await upsertConfig(guildId, { controlPanelMessageId: messageId });
    return true;
  }
}

/** Ensure a room's text channel has a control panel. Reposts if missing. */
export async function ensureRoomControlPanel(
  channel: TextChannel,
  config: GuildConfig,
  botUserId: string
): Promise<boolean> {
  try {
    const messages = await channel.messages.fetch({ limit: 30 });
    const hasPanel = messages.some(
      (m) =>
        m.author.id === botUserId &&
        m.embeds.some((e) => e.title === "🎛 Voice Room Controls")
    );
    if (hasPanel) return false;
    await postControlPanel(channel, config);
    return true;
  } catch {
    return false;
  }
}
