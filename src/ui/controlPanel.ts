/**
 * Control Panel UI - Embed, Buttons, Select Menus, Modals
 *
 * Builds the embed and components for the control panel message.
 * Discord limits: 1 select menu per ActionRow, max 5 ActionRows per message.
 */
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

// Custom IDs for button/select interactions (must match interactionCreate handler)
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
  unbanBtn: "vc:unban:btn",
} as const;

export const MODAL_IDS = {
  rename: "vc:rename:modal",
  limit: "vc:limit:modal",
} as const;

export function buildControlPanelEmbed(config: GuildConfig): EmbedBuilder {
  const color = parseInt(config.brandColor.replace("#", ""), 16) || 0x5865f2;

  return new EmbedBuilder()
    .setTitle("🎛 Voice Room Controls")
    .setDescription(
      "**Use the buttons below to manage your voice channel.**\n\n" +
        "✏️ **Rename** — Change channel name\n" +
        "👥 **Limit** — Set max users (0 = unlimited)\n" +
        "🔒 **Lock / Unlock** — Control who can join\n" +
        "🌐 **Public / Private** — Channel visibility\n" +
        "👑 **Transfer / Claim** — Ownership changes\n" +
        "👢 **Kick / Ban / Unban** — Manage members"
    )
    .setColor(color)
    .setFooter({ text: "✧ Galaxy Voice" })
    .setTimestamp();
}

export function buildControlPanelComponents(): ActionRowBuilder<MessageActionRowComponentBuilder>[] {
  const row1 = new ActionRowBuilder<MessageActionRowComponentBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(CUSTOM_IDS.rename)
        .setLabel("Rename")
        .setEmoji({ name: "✏️" })
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(CUSTOM_IDS.limit)
        .setLabel("Limit")
        .setEmoji({ name: "👥" })
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(CUSTOM_IDS.lock)
        .setLabel("Lock")
        .setEmoji({ name: "🔒" })
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(CUSTOM_IDS.unlock)
        .setLabel("Unlock")
        .setEmoji({ name: "🔓" })
        .setStyle(ButtonStyle.Success)
    );

  const row2 = new ActionRowBuilder<MessageActionRowComponentBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(CUSTOM_IDS.public)
        .setLabel("Public")
        .setEmoji({ name: "🌐" })
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(CUSTOM_IDS.private)
        .setLabel("Private")
        .setEmoji({ name: "🔐" })
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(CUSTOM_IDS.claim)
        .setLabel("Claim")
        .setEmoji({ name: "👑" })
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(CUSTOM_IDS.unbanBtn)
        .setLabel("Unban")
        .setEmoji({ name: "✅" })
        .setStyle(ButtonStyle.Secondary)
    );

  const row3 = new ActionRowBuilder<MessageActionRowComponentBuilder>()
    .addComponents(
      new UserSelectMenuBuilder()
        .setCustomId(CUSTOM_IDS.transfer)
        .setPlaceholder("↗️ Transfer ownership to…")
        .setMinValues(1)
        .setMaxValues(1)
    );

  // Discord: 1 select menu per ActionRow, max 5 ActionRows per message
  const row4 = new ActionRowBuilder<MessageActionRowComponentBuilder>()
    .addComponents(
      new UserSelectMenuBuilder()
        .setCustomId(CUSTOM_IDS.kick)
        .setPlaceholder("👢 Kick user…")
        .setMinValues(1)
        .setMaxValues(1)
    );
  const row5 = new ActionRowBuilder<MessageActionRowComponentBuilder>()
    .addComponents(
      new UserSelectMenuBuilder()
        .setCustomId(CUSTOM_IDS.ban)
        .setPlaceholder("🚫 Ban user…")
        .setMinValues(1)
        .setMaxValues(1)
    );
  return [row1, row2, row3, row4, row5];
}

export function buildRenameModal(): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(MODAL_IDS.rename)
    .setTitle("✏️ Rename Channel")
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
    .setTitle("👥 Set User Limit")
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
