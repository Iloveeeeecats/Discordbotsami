# Production Discord System Bot

A portable, prefix-command Discord system bot built with Node.js, discord.js, and PostgreSQL. It does not depend on Replit and can be uploaded to Bot Hosting Net or another Node.js host.

## Start

```bash
npm install
npm start
```

The same commands work with pnpm:

```bash
pnpm install
pnpm --filter @workspace/discord-system-bot start
```

## Environment

Copy `.env.example` to `.env` locally, or set these values in your hosting panel:

| Variable | Required | Description |
| --- | --- | --- |
| `DISCORD_TOKEN` | yes | Bot token. Never commit this value. |
| `BOT_OWNER_IDS` | yes | Comma-separated Discord user IDs with owner-only access. |
| `DATABASE_URL` | yes | PostgreSQL connection string. |
| `DEFAULT_PREFIX` | no | Initial prefix for new servers, defaults to `.`. |
| `DATABASE_SSL` | no | Set `true` when the database provider requires TLS. |

The database schema is created automatically on startup. Important bot state is stored in PostgreSQL, not memory.

## Discord Developer Portal

Enable these **Privileged Gateway Intents**:

- Server Members Intent — welcome, blacklist, jail, role and member systems.
- Message Content Intent — required for prefix commands and filters.
- Presence Intent — only used for the bot presence and can be disabled if not needed.

Request these bot permissions at minimum:

- View Channels
- Send Messages
- Embed Links
- Read Message History
- Manage Messages
- Manage Channels
- Manage Roles
- Manage Nicknames
- Kick Members
- Ban Members
- Moderate Members
- View Audit Log
- Manage Webhooks (only if webhook protection is enabled)
- Add Reactions

Use the smallest permission set that matches the systems you enable. The bot still cannot override Discord's role hierarchy or API limitations.

## Command behavior

The bot is prefix based. The default is `.`, and `.setprefix !` changes the server to `!`. Help output is generated from the actual command registry and sent by DM to bot owners and server administrators only. Owner-only profile commands are never granted by server administrator permission.

Implemented command groups include:

- General information and member tools
- Moderation: ban, unban, kick, timeout, warnings, clear, lock, slowmode, nickname, roles
- Staff role permissions
- Persistent jail and rejoin reapplication
- Private ticket panels
- Blacklist and whitelist with separate permission handling
- Audit-log anti-nuke thresholds
- Whole-word filtering and anti-spam
- Deleted-message snipe
- XP, levels, automatic level roles, leaderboard
- Counting channel
- Welcome messages and templates
- Server backups of data Discord exposes to bots
- Safe custom aliases
- Global bot profile commands: `.setname`, `.setavatar`, `.setbanner`
- Per-server bot profile commands: `.servername`, `.serveravatar`, `.serverbanner`, `.serverbio`
- Owner-controlled profile presence: `.setstatus`, `.clearstatus`, and `/botstatus`
- Guild slash commands: `/ticketpanel`, `/colorpanel`, `/rulepanel`, and `/embed`

Emoji/sticker copying and backup restore follow Discord's API limits. Per-server bot avatar, banner, and bio use Discord's current Modify Current Member support. Profile effects and profile colors are still unavailable to bot accounts, so those commands explain the limitation instead of changing the global profile by mistake.

## Slash panels

Slash commands are registered per server when the bot starts and again when it joins a server:

```text
/ticketpanel create
/ticketpanel edit
/colorpanel create
/colorpanel edit
/rulepanel create
/rulepanel edit
/embed save
/embed send
/embed edit
/embed delete
/embed list
```

Panel messages store their configuration in PostgreSQL. Ticket opening text, panel copy, button labels, target channels, categories, color definitions, images, thumbnails, and rules acknowledgement roles can be edited without recreating the bot.

## Bot profile activity

Configured bot owners can change the activity shown next to the bot profile:

```text
.setstatus playing Community support
.setstatus watching 250 servers idle
.setstatus listening Support requests
.setstatus streaming Live support https://twitch.tv/example
.clearstatus
```

The slash equivalent is `/botstatus set`, with activity type, activity text, online state, and stream URL options. Supported activity types are Playing, Streaming, Listening, Watching, and Competing. Discord does not expose normal custom-status text for bot accounts, so the bot uses supported activity types instead.

Ticket panels open a reason picker after the user clicks the main button. Configure reasons with:

```text
label|description|emoji;label|description|emoji
```

For example:

```text
شراء|فتح تذكرة لغرض الشراء|🛒;استفسار|فتح تذكرة للاستفسار|❓
```

Ticket buttons support grey, blue, green, and red Discord styles. `button_emoji` accepts Unicode emoji or a server emoji mention such as `<:cart:123456789>`. The same emoji format can be used for each reason.

## Hosting

Set the three required environment variables in the hosting panel, choose Node.js, run `npm install`, and use `npm start` as the startup command. No browser login, Replit-specific service, fixed port, local file database, or uptime ping is required.

## Security notes

- Secrets are read only from environment variables.
- Owner identity is separate from server administrator identity.
- Every destructive member action checks actor hierarchy and bot hierarchy.
- Custom aliases can target only implemented non-owner commands and are stored per server.
- The anti-nuke system uses Discord audit logs, persistent security events, thresholds, whitelist checks, and configurable punishment.
- Technical errors are logged to the host console; Discord users receive clean error embeds.