# VoiceChat-TS — Discord Voice Automation Bot

A Discord bot that creates personal voice channels when users join a "Join To Create" channel. Each room gets a private text chat and a control panel for Rename, Lock, Kick, Ban, and more. Free to use under MIT.

**Author:** Blake McBride · **Company:** epildevconnect ltd · **GitHub:** [gitEpildev/VoiceChat-TS](https://github.com/gitEpildev/VoiceChat-TS)

---

## Quick Start

1. `cp .env.example .env` and set `BOT_TOKEN`, `CLIENT_ID`, `DATABASE_URL`
2. `npm install` then `npm run migrate`
3. Invite the bot with Administrator permission
4. Run `/setup` in your server
5. Join the "Join To Create" channel — your room is created automatically

---

## Features

- **Dynamic Voice Channels** — Join the "Join To Create" channel to auto-create your voice + text channel pair
- **Control Panel** — Buttons and menus in each room's text channel (Rename, Lock, Transfer, Kick, Ban, etc.)
- **Auto-Move** — Bot moves you into your new room as soon as it's created
- **Auto-Delete** — Empty rooms are deleted after a configurable delay (default 10 seconds)
- **Claim System** — Take ownership when the original owner leaves
- **Logging** — Optional log channel for events
- **Multi-Guild** — Works in multiple servers
- **Restart Recovery** — Re-schedules delete timers and repairs state on startup

## For New Coders

### Project Structure

```
src/
├── index.ts              # Entry point: starts bot, connects DB, runs recovery
├── deploy-commands.ts    # Registers slash commands with Discord (run once)
├── db/
│   ├── postgres.ts       # Database connection pool and query helpers
│   ├── migrate.ts        # Runs SQL migrations
│   └── migrations/       # SQL files that create/update tables
├── services/
│   ├── ConfigService.ts  # Guild settings (category, delete delay, etc.)
│   ├── VoiceService.ts   # Create rooms, move users, side chat permissions
│   ├── ControlPanelService.ts  # Post/repair the control panel embed
│   ├── PermissionService.ts    # Admin checks, channel permission overwrites
│   └── LoggingService.ts       # Send event logs to a channel
├── events/
│   ├── voiceStateUpdate.ts   # Fires when users join/leave voice channels
│   └── interactionCreate.ts  # Fires for slash commands and button clicks
├── commands/
│   ├── definitions.ts   # Slash command definitions (/setup, /vc, etc.)
│   ├── router.ts        # Routes commands to handlers
│   ├── admin/           # /setup, /reset, /repair, /config, etc.
│   └── user/            # /vc rename, /vc lock, etc.
├── ui/
│   └── controlPanel.ts  # Builds embed + buttons for the control panel
└── utils/
    ├── timers.ts        # Schedule/cancel delete timers for empty rooms
    ├── template.ts      # {username} -> actual username for channel names
    └── validators.ts    # Validate rename, limit, etc.
```

### How It Works

1. **User joins "Join To Create"** → `voiceStateUpdate` fires
2. **VoiceService.createVoiceChannel** creates voice + text channels, sets permissions, moves user, posts control panel
3. **User leaves room** → If empty, `scheduleDelete` runs after delay, then deletes channels and DB row
4. **Button clicks** → `interactionCreate` handles Rename, Lock, Kick, etc.

### Environment Variables

| Variable | Description |
|----------|-------------|
| `BOT_TOKEN` | Discord bot token (required) |
| `CLIENT_ID` | Discord application ID (required for deploy-commands) |
| `DATABASE_URL` | PostgreSQL connection string |
| `BOT_OWNER` | Comma-separated user IDs who can run admin commands in any server |

## Requirements

- Node.js 20+
- PostgreSQL 14+ (or use Docker)
- Discord Bot with **Server Members Intent** and **Guild Voice States** enabled

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and set `BOT_TOKEN`, `CLIENT_ID`, and `DATABASE_URL`.

### 3. Enable Discord Intents

In [Discord Developer Portal](https://discord.com/developers/applications):

1. Select your application
2. **Bot** → **Privileged Gateway Intents**
3. Enable **Server Members Intent**

### 4. Run Migrations

```bash
npm run migrate
```

### 5. Deploy Commands (Optional — bot also deploys on startup)

```bash
npm run deploy-commands
```

### 6. Start the Bot

```bash
npm run dev    # Development with hot reload
# or
npm run build && npm start   # Production
```

### Docker

```bash
cp .env.example .env
# Set BOT_TOKEN, CLIENT_ID in .env
docker compose up -d
```

## Invite the Bot

Use this URL (replace `YOUR_CLIENT_ID`):

```
https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=8&scope=bot%20applications.commands
```

Then run **`/setup`** in your server (as server owner or BOT_OWNER).

## Commands

### Admin (Server Owner or BOT_OWNER)

| Command | Description |
|---------|-------------|
| `/setup` | Create category, Join To Create channel, and control panel |
| `/config view` | View current guild config |
| `/config set option value` | Set nametemplate, brandcolor, cooldown, deletedelay, etc. |
| `/setlogchannel` | Set the channel for event logs |
| `/enable` | Enable voice automation |
| `/disable` | Disable voice automation |
| `/repair` | Repair control panels and sync permissions |
| `/reset` | Delete all rooms and create fresh setup |

### User

| Command | Description |
|---------|-------------|
| `/vc rename <name>` | Rename your voice channel |
| `/vc limit <0-99>` | Set user limit (0 = unlimited) |
| `/vc lock` / `/vc unlock` | Lock or unlock the channel |
| `/vc public` / `/vc private` | Change visibility |
| `/vc transfer <user>` | Transfer ownership |
| `/vc claim` | Claim ownership if owner left |
| `/vc unban <user>` | Unban a user |

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start with hot reload |
| `npm run build` | Compile TypeScript |
| `npm start` | Run compiled bot |
| `npm run deploy-commands` | Register slash commands |
| `npm run migrate` | Run database migrations |
| `npm run lint` | Run ESLint |
| `npm run format` | Format with Prettier |

## License

See [LICENSE](LICENSE) — MIT License. Free to use, modify, and distribute.
