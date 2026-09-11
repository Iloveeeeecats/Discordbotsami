import { AuditLogEvent, PermissionFlagsBits } from "discord.js";
import { error, info } from "./embeds.js";
import { wholeWordMatch } from "./utils.js";

export class SecurityService {
  constructor(db) {
    this.db = db;
    this.windows = new Map();
    this.spam = new Map();
  }

  reset(guildId) {
    for (const key of this.windows.keys()) if (key.startsWith(`${guildId}:`)) this.windows.delete(key);
  }

  async monitorMessage(message, settings, state) {
    if (!message.guild || message.author.bot) return false;
    if (await this.db.hasListMember("whitelist", message.guild.id, message.author.id)) return false;
    if (message.member?.permissions.has(PermissionFlagsBits.Administrator) && message.guild.ownerId === message.author.id) return false;
    const now = Date.now();
    const spamKey = `${message.guild.id}:${message.author.id}`;
    const history = (this.spam.get(spamKey) || []).filter((timestamp) => now - timestamp < 8_000);
    history.push(now);
    this.spam.set(spamKey, history);
    if (settings.anti_spam_enabled && history.length >= 6) {
      this.spam.set(spamKey, []);
      await message.delete().catch(() => {});
      await message.member?.timeout(30_000, "Anti-spam protection").catch(() => {});
      return true;
    }
    if (settings.word_filter_enabled) {
      const words = await this.db.getWords(message.guild.id);
      if (wholeWordMatch(message.content, words)) {
        await message.delete().catch(() => {});
        await message.channel.send({ embeds: [error("Message removed", `<@${message.author.id}>, that message matched a filtered word.`)] }).then((sent) => setTimeout(() => sent.delete().catch(() => {}), 5_000)).catch(() => {});
        return true;
      }
    }
    if (settings.counting_channel_id === message.channel.id && /^\d+$/.test(message.content.trim())) {
      const expected = (settings.counting_value || 0) + 1;
      const correct = Number(message.content.trim()) === expected && settings.counting_last_user_id !== message.author.id;
      if (!correct) {
        await message.delete().catch(() => {});
        await this.db.updateGuild(message.guild.id, { counting_value: 0, counting_last_user_id: null });
        return true;
      }
      await this.db.updateGuild(message.guild.id, { counting_value: expected, counting_last_user_id: message.author.id });
    }
    return false;
  }

  async audit(guild, settings) {
    if (!settings.full_security_enabled) return;
    const watched = [
      [AuditLogEvent.MemberBanAdd, "ban"],
      [AuditLogEvent.MemberKick, "kick"],
      [AuditLogEvent.ChannelDelete, "channelDelete"],
      [AuditLogEvent.RoleDelete, "roleDelete"],
      [AuditLogEvent.WebhookCreate, "webhook"],
      [AuditLogEvent.WebhookDelete, "webhook"],
    ];
    for (const [type, action] of watched) {
      const logs = await guild.fetchAuditLogs({ type, limit: 1 }).catch(() => null);
      const entry = logs?.entries.first();
      if (!entry || Date.now() - entry.createdTimestamp > 10_000 || !entry.executor) continue;
      if (entry.executor.id === guild.client.user.id || await this.db.hasListMember("whitelist", guild.id, entry.executor.id)) continue;
      const key = `${guild.id}:${entry.executor.id}:${action}`;
      const state = this.windows.get(key) || { count: 0, last: 0 };
      if (Date.now() - state.last > 60_000) state.count = 0;
      state.count += 1;
      state.last = Date.now();
      this.windows.set(key, state);
      const limit = Number(settings.security_limits?.[action] || 3);
      await this.db.recordSecurityEvent(guild.id, entry.executor.id, action, { count: state.count, limit });
      if (state.count < limit) continue;
      const member = await guild.members.fetch(entry.executor.id).catch(() => null);
      if (member?.manageable) {
        if (settings.security_punishment === "ban" && member.bannable) await member.ban({ reason: `Anti-nuke: ${action} threshold exceeded` }).catch(() => {});
        else if (member.moderatable) await member.timeout(86_400_000, `Anti-nuke: ${action} threshold exceeded`).catch(() => {});
        else await member.roles.set([], "Anti-nuke: threshold exceeded").catch(() => {});
      }
      const channel = settings.security_log_channel_id && guild.channels.cache.get(settings.security_log_channel_id);
      if (channel?.isTextBased()) await channel.send({ embeds: [info("Security action", `<@${entry.executor.id}> exceeded the \`${action}\` threshold and was punished.`)] }).catch(() => {});
      state.count = 0;
    }
  }
}