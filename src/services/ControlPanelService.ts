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
