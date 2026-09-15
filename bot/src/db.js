import pg from "pg";
import { config } from "./config.js";

const { Pool } = pg;

const schema = `
CREATE TABLE IF NOT EXISTS guild_settings (
  guild_id TEXT PRIMARY KEY,
  prefix TEXT NOT NULL DEFAULT '.',
  welcome_channel_id TEXT,
  welcome_template TEXT,
  log_channel_id TEXT,
  security_log_channel_id TEXT,
  delete_command_messages BOOLEAN NOT NULL DEFAULT false,
  jail_role_id TEXT,
  jail_channel_id TEXT,
  ticket_category_id TEXT,
  ticket_log_channel_id TEXT,
  ticket_panel JSONB,
  color_panel JSONB,
  rules_panel JSONB,
  emoji_channel_id TEXT,
  level_channel_id TEXT,
  counting_channel_id TEXT,
  counting_value INTEGER NOT NULL DEFAULT 0,
  counting_last_user_id TEXT,
  word_filter_enabled BOOLEAN NOT NULL DEFAULT false,
  anti_spam_enabled BOOLEAN NOT NULL DEFAULT false,
  full_security_enabled BOOLEAN NOT NULL DEFAULT false,
  security_limits JSONB NOT NULL DEFAULT '{"ban": 3, "kick": 3, "channelDelete": 3, "roleDelete": 3, "webhook": 3}'::jsonb,
  security_punishment TEXT NOT NULL DEFAULT 'strip',
  xp_min INTEGER NOT NULL DEFAULT 8,
  xp_max INTEGER NOT NULL DEFAULT 16,
  xp_cooldown_seconds INTEGER NOT NULL DEFAULT 60,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS color_channel_id TEXT;
ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS ticket_panel JSONB;
ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS color_panel JSONB;
ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS rules_panel JSONB;
CREATE TABLE IF NOT EXISTS warnings (
  id BIGSERIAL PRIMARY KEY,
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  moderator_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS warnings_lookup ON warnings(guild_id, user_id);
CREATE TABLE IF NOT EXISTS blacklist (
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  added_by TEXT NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(guild_id, user_id)
);
CREATE TABLE IF NOT EXISTS whitelist (
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  added_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(guild_id, user_id)
);
CREATE TABLE IF NOT EXISTS role_permissions (
  guild_id TEXT NOT NULL,
  role_id TEXT NOT NULL,
  command_name TEXT NOT NULL,
  PRIMARY KEY(guild_id, role_id, command_name)
);
CREATE TABLE IF NOT EXISTS jailed_users (
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  previous_role_ids TEXT[] NOT NULL DEFAULT '{}',
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(guild_id, user_id)
);
CREATE TABLE IF NOT EXISTS xp (
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  points INTEGER NOT NULL DEFAULT 0,
  message_count INTEGER NOT NULL DEFAULT 0,
  last_xp_at TIMESTAMPTZ,
  PRIMARY KEY(guild_id, user_id)
);
CREATE TABLE IF NOT EXISTS level_roles (
  guild_id TEXT NOT NULL,
  level INTEGER NOT NULL,
  role_id TEXT NOT NULL,
  PRIMARY KEY(guild_id, level)
);
CREATE TABLE IF NOT EXISTS words (
  guild_id TEXT NOT NULL,
  word TEXT NOT NULL,
  PRIMARY KEY(guild_id, word)
);
CREATE TABLE IF NOT EXISTS aliases (
  guild_id TEXT NOT NULL,
  alias TEXT NOT NULL,
  command_name TEXT NOT NULL,
  PRIMARY KEY(guild_id, alias)
);
CREATE TABLE IF NOT EXISTS color_roles (
  guild_id TEXT NOT NULL,
  number INTEGER NOT NULL,
  role_id TEXT NOT NULL,
  role_name TEXT NOT NULL,
  hex TEXT NOT NULL,
  PRIMARY KEY(guild_id, number)
);
CREATE TABLE IF NOT EXISTS custom_embeds (
  guild_id TEXT NOT NULL,
  name TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_by TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(guild_id, name)
);
CREATE TABLE IF NOT EXISTS security_events (
  id BIGSERIAL PRIMARY KEY,
  guild_id TEXT NOT NULL,
  executor_id TEXT,
  action TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS backups (
  id BIGSERIAL PRIMARY KEY,
  guild_id TEXT NOT NULL,
  created_by TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

export class Database {
  constructor() {
    this.pool = new Pool({
      connectionString: config.databaseUrl,
      ssl: config.databaseSsl ? { rejectUnauthorized: false } : undefined,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
  }

  async init() {
    await this.pool.query(schema);
  }

  async close() {
    await this.pool.end();
  }

  async query(text, values = []) {
    return this.pool.query(text, values);
  }

  async ensureGuild(guildId) {
    await this.query(
      `INSERT INTO guild_settings (guild_id, prefix) VALUES ($1, $2)
       ON CONFLICT (guild_id) DO NOTHING`,
      [guildId, config.defaultPrefix],
    );
    return this.getGuild(guildId);
  }

  async getGuild(guildId) {
    await this.ensureGuildRow(guildId);
    const { rows } = await this.query("SELECT * FROM guild_settings WHERE guild_id = $1", [guildId]);
    return rows[0];
  }

  async ensureGuildRow(guildId) {
    await this.query(
      `INSERT INTO guild_settings (guild_id, prefix) VALUES ($1, $2)
       ON CONFLICT (guild_id) DO NOTHING`,
      [guildId, config.defaultPrefix],
    );
  }

  async updateGuild(guildId, fields) {
    await this.ensureGuildRow(guildId);
    const allowed = new Set([
      "prefix", "welcome_channel_id", "welcome_template", "log_channel_id",
      "security_log_channel_id", "delete_command_messages", "jail_role_id",
      "jail_channel_id", "ticket_category_id", "ticket_log_channel_id",
      "ticket_panel", "color_panel", "rules_panel",
      "emoji_channel_id", "level_channel_id", "counting_channel_id",
      "color_channel_id",
      "counting_value", "counting_last_user_id", "word_filter_enabled",
      "anti_spam_enabled", "full_security_enabled", "security_limits",
      "security_punishment", "xp_min", "xp_max", "xp_cooldown_seconds",
    ]);
    const entries = Object.entries(fields).filter(([key]) => allowed.has(key));
    if (!entries.length) return this.getGuild(guildId);
    const values = [guildId];
    const sets = entries.map(([key, value], index) => {
      values.push(value);
      return `${key} = $${index + 2}`;
    });
    sets.push("updated_at = NOW()");
    await this.query(`UPDATE guild_settings SET ${sets.join(", ")} WHERE guild_id = $1`, values);
    return this.getGuild(guildId);
  }

  async addWarning(guildId, userId, moderatorId, reason) {
    await this.query(
      "INSERT INTO warnings (guild_id, user_id, moderator_id, reason) VALUES ($1, $2, $3, $4)",
      [guildId, userId, moderatorId, reason],
    );
  }

  async listWarnings(guildId, userId) {
    const { rows } = await this.query(
      "SELECT * FROM warnings WHERE guild_id = $1 AND user_id = $2 ORDER BY created_at DESC LIMIT 25",
      [guildId, userId],
    );
    return rows;
  }

  async setListMember(table, guildId, userId, actorId, reason = null) {
    await this.query(
      `INSERT INTO ${table} (guild_id, user_id, added_by, reason) VALUES ($1, $2, $3, $4)
       ON CONFLICT (guild_id, user_id) DO NOTHING`,
      [guildId, userId, actorId, reason],
    );
  }

  async removeListMember(table, guildId, userId) {
    await this.query(`DELETE FROM ${table} WHERE guild_id = $1 AND user_id = $2`, [guildId, userId]);
  }

  async hasListMember(table, guildId, userId) {
    const { rowCount } = await this.query(`SELECT 1 FROM ${table} WHERE guild_id = $1 AND user_id = $2`, [guildId, userId]);
    return rowCount > 0;
  }

  async listMembers(table, guildId) {
    const { rows } = await this.query(`SELECT * FROM ${table} WHERE guild_id = $1 ORDER BY created_at`, [guildId]);
    return rows;
  }

  async setRolePermission(guildId, roleId, commandName) {
    await this.query(
      `INSERT INTO role_permissions (guild_id, role_id, command_name) VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING`,
      [guildId, roleId, commandName],
    );
  }

  async clearRolePermissions(guildId, roleId) {
    await this.query("DELETE FROM role_permissions WHERE guild_id = $1 AND role_id = $2", [guildId, roleId]);
  }

  async roleHasPermission(guildId, member, commandName) {
    const roleIds = [...member.roles.cache.keys()];
    if (!roleIds.length) return false;
    const { rowCount } = await this.query(
      `SELECT 1 FROM role_permissions WHERE guild_id = $1 AND role_id = ANY($2) AND command_name = $3 LIMIT 1`,
      [guildId, roleIds, commandName],
    );
    return rowCount > 0;
  }

  async saveJail(guildId, userId, roleIds, reason) {
    await this.query(
      `INSERT INTO jailed_users (guild_id, user_id, previous_role_ids, reason)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (guild_id, user_id) DO UPDATE SET previous_role_ids = $3, reason = $4`,
      [guildId, userId, roleIds, reason],
    );
  }

  async getJail(guildId, userId) {
    const { rows } = await this.query("SELECT * FROM jailed_users WHERE guild_id = $1 AND user_id = $2", [guildId, userId]);
    return rows[0];
  }

  async removeJail(guildId, userId) {
    await this.query("DELETE FROM jailed_users WHERE guild_id = $1 AND user_id = $2", [guildId, userId]);
  }

  async getXp(guildId, userId) {
    const { rows } = await this.query(
      `INSERT INTO xp (guild_id, user_id) VALUES ($1, $2)
       ON CONFLICT (guild_id, user_id) DO NOTHING
       RETURNING *`,
      [guildId, userId],
    );
    if (rows[0]) return rows[0];
    const result = await this.query("SELECT * FROM xp WHERE guild_id = $1 AND user_id = $2", [guildId, userId]);
    return result.rows[0];
  }

  async addXp(guildId, userId, amount) {
    const { rows } = await this.query(
      `INSERT INTO xp (guild_id, user_id, points, message_count, last_xp_at)
       VALUES ($1, $2, $3, 1, NOW())
       ON CONFLICT (guild_id, user_id) DO UPDATE
       SET points = xp.points + $3, message_count = xp.message_count + 1, last_xp_at = NOW()
       RETURNING *`,
      [guildId, userId, amount],
    );
    return rows[0];
  }

  async resetXp(guildId, userId) {
    await this.query("DELETE FROM xp WHERE guild_id = $1 AND user_id = $2", [guildId, userId]);
  }

  async leaderboard(guildId) {
    const { rows } = await this.query("SELECT * FROM xp WHERE guild_id = $1 ORDER BY points DESC LIMIT 10", [guildId]);
    return rows;
  }

  async getLevelRoles(guildId) {
    const { rows } = await this.query("SELECT * FROM level_roles WHERE guild_id = $1 ORDER BY level", [guildId]);
    return rows;
  }

  async setLevelRole(guildId, level, roleId) {
    await this.query(
      `INSERT INTO level_roles (guild_id, level, role_id) VALUES ($1, $2, $3)
       ON CONFLICT (guild_id, level) DO UPDATE SET role_id = $3`,
      [guildId, level, roleId],
    );
  }

  async removeLevelRole(guildId, level) {
    await this.query("DELETE FROM level_roles WHERE guild_id = $1 AND level = $2", [guildId, level]);
  }

  async getWords(guildId) {
    const { rows } = await this.query("SELECT word FROM words WHERE guild_id = $1 ORDER BY word", [guildId]);
    return rows.map((row) => row.word);
  }

  async addWord(guildId, word) {
    await this.query("INSERT INTO words (guild_id, word) VALUES ($1, $2) ON CONFLICT DO NOTHING", [guildId, word]);
  }

  async removeWord(guildId, word) {
    await this.query("DELETE FROM words WHERE guild_id = $1 AND word = $2", [guildId, word]);
  }

  async getAlias(guildId, alias) {
    const { rows } = await this.query("SELECT command_name FROM aliases WHERE guild_id = $1 AND alias = $2", [guildId, alias]);
    return rows[0]?.command_name;
  }

  async listAliases(guildId) {
    const { rows } = await this.query("SELECT * FROM aliases WHERE guild_id = $1 ORDER BY alias", [guildId]);
    return rows;
  }

  async setAlias(guildId, alias, commandName) {
    await this.query(
      `INSERT INTO aliases (guild_id, alias, command_name) VALUES ($1, $2, $3)
       ON CONFLICT (guild_id, alias) DO UPDATE SET command_name = $3`,
      [guildId, alias, commandName],
    );
  }

  async removeAlias(guildId, alias) {
    await this.query("DELETE FROM aliases WHERE guild_id = $1 AND alias = $2", [guildId, alias]);
  }

  async recordSecurityEvent(guildId, executorId, action, metadata = {}) {
    await this.query(
      "INSERT INTO security_events (guild_id, executor_id, action, metadata) VALUES ($1, $2, $3, $4)",
      [guildId, executorId, action, metadata],
    );
  }

  async saveBackup(guildId, createdBy, payload) {
    const { rows } = await this.query(
      "INSERT INTO backups (guild_id, created_by, payload) VALUES ($1, $2, $3) RETURNING id, created_at",
      [guildId, createdBy, payload],
    );
    return rows[0];
  }

  async getBackup(guildId, id) {
    const query = id
      ? "SELECT * FROM backups WHERE guild_id = $1 AND id = $2"
      : "SELECT * FROM backups WHERE guild_id = $1 ORDER BY created_at DESC LIMIT 1";
    const values = id ? [guildId, id] : [guildId];
    const { rows } = await this.query(query, values);
    return rows[0];
  }

  async saveColorRole(guildId, number, roleId, roleName, hex) {
    await this.query(
      `INSERT INTO color_roles (guild_id, number, role_id, role_name, hex)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (guild_id, number) DO UPDATE
       SET role_id = $3, role_name = $4, hex = $5`,
      [guildId, number, roleId, roleName, hex],
    );
  }

  async getColorRoles(guildId) {
    const { rows } = await this.query("SELECT * FROM color_roles WHERE guild_id = $1 ORDER BY number", [guildId]);
    return rows;
  }

  async saveCustomEmbed(guildId, name, payload, createdBy) {
    await this.query(
      `INSERT INTO custom_embeds (guild_id, name, payload, created_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (guild_id, name) DO UPDATE
       SET payload = $3, updated_at = NOW()`,
      [guildId, name, payload, createdBy],
    );
  }

  async getCustomEmbed(guildId, name) {
    const { rows } = await this.query(
      "SELECT * FROM custom_embeds WHERE guild_id = $1 AND name = $2",
      [guildId, name],
    );
    return rows[0];
  }

  async listCustomEmbeds(guildId) {
    const { rows } = await this.query(
      "SELECT name, created_by, updated_at FROM custom_embeds WHERE guild_id = $1 ORDER BY name",
      [guildId],
    );
    return rows;
  }

  async removeCustomEmbed(guildId, name) {
    await this.query("DELETE FROM custom_embeds WHERE guild_id = $1 AND name = $2", [guildId, name]);
  }
}