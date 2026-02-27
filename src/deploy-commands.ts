import {
  REST,
  Routes,
  SlashCommandBuilder,
  type RESTPostAPIChatInputApplicationCommandsJSONBody,
} from "discord.js";

const token = process.env.BOT_TOKEN;
const clientId = process.env.CLIENT_ID;

if (!token || !clientId) {
  console.error("BOT_TOKEN and CLIENT_ID must be set.");
  process.exit(1);
}

const commands: RESTPostAPIChatInputApplicationCommandsJSONBody[] = [
  new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Set up voice automation (category, creator channel, control panel)")
    .toJSON(),
  new SlashCommandBuilder()
    .setName("config")
    .setDescription("View or update guild config")
    .addSubcommand((s) =>
      s.setName("view").setDescription("View current config")
    )
    .addSubcommand((s) =>
      s
        .setName("set")
        .setDescription("Set a config option")
        .addStringOption((o) =>
          o
            .setName("option")
            .setDescription("Option to set")
            .setRequired(true)
            .addChoices(
              { name: "nametemplate", value: "nametemplate" },
              { name: "brandcolor", value: "brandcolor" },
              { name: "cooldown", value: "cooldown" },
              { name: "deletedelay", value: "deletedelay" },
              { name: "claimtimeout", value: "claimtimeout" },
              { name: "maxchannelsperuser", value: "maxchannelsperuser" }
            )
        )
        .addStringOption((o) =>
          o.setName("value").setDescription("Value").setRequired(true)
        )
    )
    .toJSON(),
  new SlashCommandBuilder()
    .setName("setlogchannel")
    .setDescription("Set the channel for logging events")
    .addChannelOption((o) =>
      o
        .setName("channel")
        .setDescription("Text channel for logs")
        .setRequired(true)
    )
    .toJSON(),
  new SlashCommandBuilder()
    .setName("enable")
    .setDescription("Enable voice automation")
    .toJSON(),
  new SlashCommandBuilder()
    .setName("disable")
    .setDescription("Disable voice automation")
    .toJSON(),
  new SlashCommandBuilder()
    .setName("repair")
    .setDescription("Repair control panel and sync permissions")
    .toJSON(),
  new SlashCommandBuilder()
    .setName("vc")
    .setDescription("Voice channel control commands")
    .addSubcommand((s) =>
      s
        .setName("rename")
        .setDescription("Rename your voice channel")
        .addStringOption((o) =>
          o
            .setName("name")
            .setDescription("New channel name (1-100 chars)")
            .setRequired(true)
        )
    )
    .addSubcommand((s) =>
      s
        .setName("limit")
        .setDescription("Set user limit (0 = unlimited)")
        .addIntegerOption((o) =>
          o
            .setName("number")
            .setDescription("Limit 0-99")
            .setRequired(true)
            .setMinValue(0)
            .setMaxValue(99)
        )
    )
    .addSubcommand((s) =>
      s.setName("lock").setDescription("Lock the channel (only you can let others in)")
    )
    .addSubcommand((s) =>
      s.setName("unlock").setDescription("Unlock the channel")
    )
    .addSubcommand((s) =>
      s.setName("public").setDescription("Make the channel public")
    )
    .addSubcommand((s) =>
      s.setName("private").setDescription("Make the channel private")
    )
    .addSubcommand((s) =>
      s
        .setName("transfer")
        .setDescription("Transfer ownership to another user")
        .addUserOption((o) =>
          o
            .setName("user")
            .setDescription("User to transfer to")
            .setRequired(true)
        )
    )
    .addSubcommand((s) =>
      s.setName("claim").setDescription("Claim ownership if the owner left")
    )
    .addSubcommand((s) =>
      s
        .setName("unban")
        .setDescription("Unban a user from your voice channel")
        .addUserOption((o) =>
          o
            .setName("user")
            .setDescription("User to unban")
            .setRequired(true)
        )
    )
    .toJSON(),
];

const rest = new REST({ version: "10" }).setToken(token);

async function main(): Promise<void> {
  console.log("Deploying commands...");
  const result = await rest.put(
    Routes.applicationCommands(clientId as string),
    { body: commands }
  );
  console.log(`Deployed ${Array.isArray(result) ? result.length : 0} commands.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
