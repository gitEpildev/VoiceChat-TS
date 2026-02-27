import type { ChatInputCommandInteraction } from "discord.js";
import { handleSetup } from "./admin/setup.js";
import { handleConfigView } from "./admin/config-view.js";
import { handleConfigSet } from "./admin/config-set.js";
import { handleSetLogChannel } from "./admin/setlogchannel.js";
import { handleEnable } from "./admin/enable.js";
import { handleDisable } from "./admin/disable.js";
import { handleRepair } from "./admin/repair.js";
import { handleVc } from "./user/vc.js";

export async function handleCommand(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const name = interaction.commandName;

  const adminCommands = [
    "setup",
    "config",
    "setlogchannel",
    "enable",
    "disable",
    "repair",
  ];

  if (adminCommands.includes(name) || (name === "config" && interaction.options.getSubcommand(false))) {
    const perms = interaction.memberPermissions;
    if (!perms?.has("ManageGuild")) {
      await interaction.reply({ content: "You need the Manage Server permission.", ephemeral: true });
      return;
    }
  }

  switch (name) {
    case "setup":
      await handleSetup(interaction);
      break;
    case "config": {
      const sub = interaction.options.getSubcommand(false);
      if (sub === "view") await handleConfigView(interaction);
      else if (sub === "set") await handleConfigSet(interaction);
      else await handleConfigView(interaction);
      break;
    }
    case "setlogchannel":
      await handleSetLogChannel(interaction);
      break;
    case "enable":
      await handleEnable(interaction);
      break;
    case "disable":
      await handleDisable(interaction);
      break;
    case "repair":
      await handleRepair(interaction);
      break;
    case "vc":
      await handleVc(interaction);
      break;
    default:
      await interaction.reply({ content: "Unknown command.", ephemeral: true });
  }
}
