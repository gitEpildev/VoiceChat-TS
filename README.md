# Premium Discord Voice Automation Bot

A production-ready Discord bot with dynamic personal voice channels, linked side chats, control panel, claim system, logging, and restart recovery. Built with TypeScript, discord.js v14, PostgreSQL, and Docker.

## Features

- **Dynamic Voice Channels** — Join the "Join To Create" channel to automatically create your own voice channel + linked private side chat
- **Control Panel** — Button-based settings (Rename, Lock, Transfer, Claim, Kick, Ban, etc.) in the side channel
- **Claim System** — Take ownership when the original owner leaves
- **Logging** — Configurable log channel for all events
- **Multi-Guild** — Full support for multiple servers
- **Restart Recovery** — Validates and repairs state on bot startup

## Requirements

- Node.js 20+
- PostgreSQL 14+ (or use Docker)
- Discord Bot with Guild Members intent enabled

## Setup (macOS)

### 1. Install Node.js 20+

```bash
# Using nvm
nvm install 20
nvm use 20

# Or using Homebrew
brew install node@20
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and set:

- `BOT_TOKEN` — Your Discord bot token
- `CLIENT_ID` — Your application ID
- `DATABASE_URL` — PostgreSQL connection string (e.g. `postgresql://user:pass@localhost:5432/voicebot`)

### 4. Enable Guild Members Intent

In the [Discord Developer Portal](https://discord.com/developers/applications):

1. Select your application
2. Go to **Bot** → **Privileged Gateway Intents**
3. Enable **Server Members Intent**

### 5. Run Migrations

```bash
npm run migrate
```

Ensure PostgreSQL is running and the database exists.

### 6. Deploy Commands

```bash
npm run deploy-commands
```

### 7. Start the Bot

```bash
# Development (with hot reload)
npm run dev

# Production
npm run build
npm start
```

## Setup (Docker)

```bash
# Copy env and set BOT_TOKEN, CLIENT_ID
cp .env.example .env

# Start PostgreSQL + Bot
docker compose up -d

# Migrations run automatically on startup
```

## Usage

### Admin Commands (Require Manage Server)

| Command | Description |
|---------|-------------|
| `/setup` | Create category, Join To Create voice, and control panel |
| `/config view` | View current guild config |
| `/config set option value` | Set nametemplate, brandcolor, cooldown, deletedelay, claimtimeout, maxchannelsperuser |
| `/setlogchannel` | Set the channel for event logs |
| `/enable` | Enable voice automation |
| `/disable` | Disable voice automation |
| `/repair` | Repair control panel and sync permissions |

### User Commands

| Command | Description |
|---------|-------------|
| `/vc rename <name>` | Rename your voice channel |
| `/vc limit <0-99>` | Set user limit (0 = unlimited) |
| `/vc lock` | Lock the channel |
| `/vc unlock` | Unlock the channel |
| `/vc public` | Make channel public |
| `/vc private` | Make channel private |
| `/vc transfer <user>` | Transfer ownership |
| `/vc claim` | Claim ownership if owner left |
| `/vc unban <user>` | Unban a user from your channel |

## Project Structure

```
src/
├── index.ts              # Entry point, client setup
├── deploy-commands.ts    # Slash command registration
├── db/                   # PostgreSQL + migrations
├── services/             # Config, Voice, Permission, Logging, ControlPanel
├── events/               # voiceStateUpdate, interactionCreate
├── commands/             # admin/ and user/ slash commands
├── ui/                   # Control panel embed and components
└── utils/                # Template, validators, timers
```

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

MIT
