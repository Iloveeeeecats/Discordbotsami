import "dotenv/config";

const splitIds = (value = "") =>
  value
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

export const config = {
  token: process.env.DISCORD_TOKEN,
  ownerIds: new Set(splitIds(process.env.BOT_OWNER_IDS)),
  databaseUrl: process.env.DATABASE_URL,
  defaultPrefix: process.env.DEFAULT_PREFIX || ".",
  databaseSsl: process.env.DATABASE_SSL === "true",
  logLevel: process.env.LOG_LEVEL || "info",
};

export function assertConfig() {
  const missing = [];
  if (!config.token) missing.push("DISCORD_TOKEN");
  if (!config.databaseUrl) missing.push("DATABASE_URL");
  if (!config.ownerIds.size) missing.push("BOT_OWNER_IDS");
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
  if (config.defaultPrefix.length > 3 || /\s/.test(config.defaultPrefix)) {
    throw new Error("DEFAULT_PREFIX must be 1-3 non-whitespace characters");
  }
}