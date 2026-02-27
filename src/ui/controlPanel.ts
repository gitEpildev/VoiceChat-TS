import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  UserSelectMenuBuilder,
  type MessageActionRowComponentBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import type { GuildConfig } from "../db/postgres.js";

const CUSTOM_IDS = {
  rename: "vc:rename",
  limit: "vc:limit",
  lock: "vc:lock",
  unlock: "vc:unlock",
  public: "vc:public",
  private: "vc:private",
  transfer: "vc:transfer",
  claim: "vc:claim",
  kick: "vc:kick",
  ban: "vc:ban",
  unban: "vc:unban",
} as const;

export const MODAL_IDS = {
  rename: "vc:rename:modal",
  limit: "vc:limit:modal",
} as const;

export function buildControlPanelEmbed(config: GuildConfig): EmbedBuilder {
  const color = parseInt(config.brandColor.replace("#", ""), 16) || 0x5865f2;

  return new EmbedBuilder()
    .setTitle("Voice Control Panel")
    .setDescription(
      "**Premium Voice Management**\n\nUse the buttons below to control your dynamic voice channel.\n\n• **Rename** — Change your channel name\n• **Set Limit** — Set user limit (0 = unlimited)\n• **Lock / Unlock** — Control who can join\n• **Public / Private** — Change visibility\n• **Transfer** — Give ownership to another member\n• **Claim** — Take ownership if the current owner left\n• **Kick / Ban** — Manage members in your channel (Unban via `/vc unban`)"
    )
    .setColor(color)
    .setFooter({ text: "Voice Automation • Premium" })
    .setTimestamp();
}

export function buildControlPanelComponents(): ActionRowBuilder<MessageActionRowComponentBuilder>[] {
  const row1 = new ActionRowBuilder<MessageActionRowComponentBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(CUSTOM_IDS.rename)
        .setLabel("Rename")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(CUSTOM_IDS.limit)
        .setLabel("Set Limit")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(CUSTOM_IDS.lock)
        .setLabel("Lock")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(CUSTOM_IDS.unlock)
        .setLabel("Unlock")
        .setStyle(ButtonStyle.Success)
    );

  const row2 = new ActionRowBuilder<MessageActionRowComponentBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(CUSTOM_IDS.public)
        .setLabel("Public")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(CUSTOM_IDS.private)
        .setLabel("Private")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(CUSTOM_IDS.claim)
        .setLabel("Claim")
        .setStyle(ButtonStyle.Danger)
    );

  const row3 = new ActionRowBuilder<MessageActionRowComponentBuilder>()
    .addComponents(
      new UserSelectMenuBuilder()
        .setCustomId(CUSTOM_IDS.transfer)
        .setPlaceholder("Select user to transfer ownership")
        .setMinValues(1)
        .setMaxValues(1)
    );

  const row4 = new ActionRowBuilder<MessageActionRowComponentBuilder>()
    .addComponents(
      new UserSelectMenuBuilder()
        .setCustomId(CUSTOM_IDS.kick)
        .setPlaceholder("Select user to kick")
        .setMinValues(1)
        .setMaxValues(1)
    );

  const row5 = new ActionRowBuilder<MessageActionRowComponentBuilder>()
    .addComponents(
      new UserSelectMenuBuilder()
        .setCustomId(CUSTOM_IDS.ban)
        .setPlaceholder("Select user to ban")
        .setMinValues(1)
        .setMaxValues(1)
    );

  return [row1, row2, row3, row4, row5];
}

export function buildRenameModal(): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(MODAL_IDS.rename)
    .setTitle("Rename Channel")
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("name")
          .setLabel("Channel Name")
          .setPlaceholder("Enter new name (1-100 chars)")
          .setStyle(TextInputStyle.Short)
          .setMinLength(1)
          .setMaxLength(100)
          .setRequired(true)
      )
    );
}

export function buildLimitModal(): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(MODAL_IDS.limit)
    .setTitle("Set User Limit")
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("limit")
          .setLabel("User Limit")
          .setPlaceholder("0-99 (0 = unlimited)")
          .setStyle(TextInputStyle.Short)
          .setMinLength(1)
          .setMaxLength(2)
          .setRequired(true)
      )
    );
}
