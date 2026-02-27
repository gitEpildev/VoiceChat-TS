import type { ChatInputCommandInteraction } from "discord.js";
import { ChannelType } from "discord.js";
import { getConfig, upsertConfigFull } from "../../services/ConfigService.js";
import { postControlPanel } from "../../services/ControlPanelService.js";

export async function handleSetup(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const guild = interaction.guild;
  if (!guild) {
    await interaction.reply({ content: "This command must be used in a server.", ephemeral: true });
    return;
  }

  const existing = await getConfig(guild.id);
  if (existing?.categoryId) {
    await interaction.reply({
      content: "Voice channels are already set up. Use /repair to fix issues, or remove the category and run /setup again.",
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    const category = await guild.channels.create({
      name: "🔊 Join To Create",
      type: ChannelType.GuildCategory,
    });

    const creatorChannel = await guild.channels.create({
      name: "🎤 Join To Create",
      type: ChannelType.GuildVoice,
      parent: category.id,
    });

    const controlPanelChannel = await guild.channels.create({
      name: "🎛︱voice-control",
      type: ChannelType.GuildText,
      parent: category.id,
    });

    const messageId = await postControlPanel(controlPanelChannel, {
      guildId: guild.id,
      enabled: 1,
      categoryId: category.id,
      creatorChannelId: creatorChannel.id,
      controlPanelChannelId: controlPanelChannel.id,
      controlPanelMessageId: null,
      logChannelId: null,
      nameTemplate: "{username}'s Room",
      brandColor: "#5865F2",
      cooldownSeconds: 60,
      deleteDelaySeconds: 300,
      claimTimeoutSeconds: 120,
      maxChannelsPerUser: 1,
    });

    await upsertConfigFull(guild.id, {
      enabled: 1,
      categoryId: category.id,
      creatorChannelId: creatorChannel.id,
      controlPanelChannelId: controlPanelChannel.id,
      controlPanelMessageId: messageId,
      nameTemplate: "{username}'s Room",
      brandColor: "#5865F2",
      cooldownSeconds: 60,
      deleteDelaySeconds: 300,
      claimTimeoutSeconds: 120,
      maxChannelsPerUser: 1,
    });

    await interaction.editReply({
      content: `Setup complete!\n• Category: ${category}\n• Creator: ${creatorChannel}\n• Control Panel: ${controlPanelChannel}\n\nUse /setlogchannel to configure logging.`,
    });
  } catch (err) {
    console.error("Setup error:", err);
    await interaction.editReply({
      content: `Setup failed: ${err instanceof Error ? err.message : "Unknown error"}`,
    });
  }
}
