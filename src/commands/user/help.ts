/**
 * /help handler - Shows bot info and command list
 */
import type { ChatInputCommandInteraction } from "discord.js";
import { EmbedBuilder } from "discord.js";

export async function handleHelp(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const embed = new EmbedBuilder()
    .setTitle("🎛 VoiceChat-TS — Help")
    .setDescription(
      "Join the **Join To Create** channel to auto-create your voice room.\n" +
        "Use the control panel in your room's text channel to manage it."
    )
    .addFields(
      {
        name: "Admin Commands",
        value:
          "`/setup` — Create category & creator channel\n" +
          "`/config view` — View settings\n" +
          "`/config set option value` — Change settings\n" +
          "`/setlogchannel` — Set log channel\n" +
          "`/enable` / `/disable` — Toggle bot\n" +
          "`/repair` — Fix control panels\n" +
          "`/reset` — Full reset",
        inline: false,
      },
      {
        name: "User Commands",
        value:
          "`/vc rename <name>` — Rename room\n" +
          "`/vc limit <0-99>` — User limit\n" +
          "`/vc lock` / `/vc unlock`\n" +
          "`/vc public` / `/vc private`\n" +
          "`/vc transfer <user>` — Give ownership\n" +
          "`/vc claim` — Take ownership if owner left\n" +
          "`/vc unban <user>` — Unban user",
        inline: false,
      }
    )
    .setColor(0x5865f2)
    .setFooter({ text: "VoiceChat-TS · epildevconnect ltd" });

  await interaction.reply({ embeds: [embed], ephemeral: true });
}
