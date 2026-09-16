# Production Discord System Bot

A portable prefix-command Discord bot with persistent PostgreSQL-backed moderation, security, community, and configuration systems.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

_Populate as you build — short repo map plus pointers to the source-of-truth file for DB schema, API contracts, theme files, etc._

## Architecture decisions

_Populate as you build — non-obvious choices a reader couldn't infer from the code (3-5 bullets)._

## Product

_Describe the high-level user-facing capabilities of this app once they exist._

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details

## Bot package

- `bot/` contains the portable Node.js Discord bot.
- `bot/src/commands.js` is the command registry and implementation surface.
- `bot/src/db.js` owns automatic PostgreSQL schema initialization and persistence.
- `bot/src/security.js` handles filtering, anti-spam, counting, and audit-log protection.
- `bot/src/slash.js` owns per-server slash-command registration, configurable panels, and interactive ticket/color/rules/embed flows.
- Run `pnpm --filter @workspace/discord-system-bot check` for syntax checks.
- Run the bot with `pnpm --filter @workspace/discord-system-bot start` after setting `DISCORD_TOKEN`, `BOT_OWNER_IDS`, and `DATABASE_URL`.

## Architecture decisions

- The bot uses PostgreSQL rather than memory or a local file because it must survive restarts and move between hosts.
- Prefixes are loaded per guild before command parsing, so commands, aliases, help, and mention responses always reflect the current server prefix.
- Unsupported server-profile endpoints are reported explicitly; global bot profile mutations are never used as a substitute.
- Global profile mutations and current-member server profile mutations use separate commands and Discord endpoints.
- Ticket panels use a configurable reason select menu, Discord button styles, Unicode/server emojis, and persistent opening-message settings.
- Owner-only access is based only on `BOT_OWNER_IDS`; Discord Administrator is intentionally separate.

## Product

The bot provides prefix commands for moderation, security, jail, tickets, blacklist/whitelist, word filtering, anti-spam, leveling, counting, welcome messages, aliases, backups, and server configuration.
