/**
 * /help handler - Shows bot info and command list
 */
import type { ChatInputCommandInteraction } from "discord.js";
import { EmbedBuilder } from "discord.js";

export async function handleHelp(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const embed = new EmbedBuilder()
    .setTitle("Voice Channel System Setup")
    .setDescription(
      "This bot allows dynamic control of temporary voice channels with advanced admin tools"
    )
    .addFields(
      {
        name: "How to Use",
        value:
          "• Join a voice channel to create or manage it\n" +
          "• Use the control panel buttons to manage settings",
        inline: false,
      },
      {
        name: "Permissions Required",
        value:
          "• Administrator permission is required for full control\n" +
          "• Admin Lock is only available to admins who own the VC",
        inline: false,
      },
      {
        name: "Admin Lock Info",
        value:
          "• Locks the channel to admins only\n" +
          "• Automatically removes non admin users\n" +
          "• Blocks future joins from non admins",
        inline: false,
      },
      {
        name: "Tips",
        value:
          "• Use Limit to control size\n" +
          "• Use Private for restricted access\n" +
          "• Transfer ownership if needed",
        inline: false,
      }
    )
    .setColor(0x5865f2)
    .setFooter({ text: "Keep channels clean and controlled" });

  await interaction.reply({ embeds: [embed], ephemeral: true });
}
