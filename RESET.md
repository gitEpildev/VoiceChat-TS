# How to Reset the Voice Bot

If commands aren't showing, channels aren't auto-deleting, or things feel stuck:

## 1. Restart the bot (updates commands)

```bash
cd /home/minecraft/VoiceChat-TS
docker compose build app --no-cache
docker compose up -d --force-recreate app
```

Wait ~30 seconds for the bot to start and deploy commands to your server.

## 2. In Discord: refresh commands

- Fully close and reopen Discord, or press `Ctrl+R`
- Type `/` — you should see `/reset`, `/setup`, `/config`, etc.

## 3. Run `/reset` (server owner or BOT_OWNER)

- `/reset` removes all old channels and creates a fresh setup
- Sets delete delay to **30 seconds** (rooms auto-delete when empty)
- One command to fix everything

## 4. If commands still don't appear

Re-invite the bot with Administrator permission:

```
https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=8&scope=bot%20applications.commands
```

Replace `YOUR_CLIENT_ID` with your bot's application ID from `.env`.
