import {
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { config } from "./config.js";
import { canUse, commandPermissionNames, hierarchyError, isBotOwner, isServerAdmin } from "./permissions.js";
import { cleanReason, levelFromXp, parseDuration, parseMentionOrId, renderTemplate, tokenize, truncate, wholeWordMatch, xpForLevel } from "./utils.js";
import { embed, error, failureMessage, info, success, warning } from "./embeds.js";
import { applyStoredPresence, normalizePresence, presenceStatuses } from "./presence.js";

const command = (definition) => definition;

function targetMember(message, token) {
  const id = parseMentionOrId(token);
  return message.guild.members.cache.get(id) || message.guild.members.cache.find((member) => member.user.username.toLowerCase() === token?.toLowerCase());
}

function targetRole(message, token) {
  const id = parseMentionOrId(token);
  return message.guild.roles.cache.get(id) || message.guild.roles.cache.find((role) => role.name.toLowerCase() === token?.toLowerCase());
}

function mediaSource(message, args) {
  return message.attachments.first()?.url || args[0];
}

function amount(value, fallback = 10) {
  const parsed = Number(value ?? fallback);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 100 ? parsed : null;
}

async function logAction(ctx, title, description, color) {
  const settings = await ctx.db.getGuild(ctx.message.guild.id);
  const channelId = settings.log_channel_id;
  const channel = channelId ? ctx.message.guild.channels.cache.get(channelId) : null;
  if (channel?.isTextBased()) await channel.send({ embeds: [embed(title, description, color)] }).catch(() => {});
}

const general = [
  command({ name: "ping", aliases: ["latency"], category: "General", description: "Check the bot and API latency.", async execute(ctx) {
    await ctx.reply({ embeds: [info("Pong", `Gateway: ${ctx.client.ws.ping}ms`)] });
  }}),
  command({ name: "botinfo", aliases: ["about"], category: "General", description: "Show bot runtime information.", async execute(ctx) {
    const uptime = Math.floor(process.uptime());
    await ctx.reply({ embeds: [info("Bot information", `Version: 1.0.0\nNode: ${process.version}\nUptime: ${Math.floor(uptime / 3600)}h ${Math.floor(uptime / 60) % 60}m ${uptime % 60}s\nServers: ${ctx.client.guilds.cache.size}`)] });
  }}),
  command({ name: "serverinfo", aliases: ["server"], category: "General", description: "Show information about this server.", async execute(ctx) {
    const g = ctx.message.guild;
    await ctx.reply({ embeds: [info("Server information", `**Owner:** <@${g.ownerId}>\n**Members:** ${g.memberCount}\n**Channels:** ${g.channels.cache.size}\n**Roles:** ${g.roles.cache.size}\n**Boosts:** ${g.premiumSubscriptionCount || 0}\n**Created:** <t:${Math.floor(g.createdTimestamp / 1000)}:F>`).setThumbnail(g.iconURL({ size: 256 }) || null)] });
  }}),
  command({ name: "userinfo", aliases: ["user"], category: "General", usage: "[user]", description: "Show information about a member.", async execute(ctx) {
    const member = targetMember(ctx.message, ctx.args[0]) || ctx.message.member;
    if (!member) return ctx.fail("User not found", "Mention a valid member or provide a user ID.");
    await ctx.reply({ embeds: [info("User information", `**User:** <@${member.id}>\n**ID:** ${member.id}\n**Joined:** <t:${Math.floor(member.joinedTimestamp / 1000)}:R>\n**Roles:** ${member.roles.cache.filter((r) => r.id !== ctx.message.guild.id).map((r) => r.name).join(", ") || "None"}`).setThumbnail(member.displayAvatarURL({ size: 256 }))] });
  }}),
  command({ name: "roleinfo", category: "General", usage: "role", description: "Show information about a role.", async execute(ctx) {
    const role = targetRole(ctx.message, ctx.args.join(" "));
    if (!role) return ctx.fail("Role not found", "Mention a role, provide its ID, or use its exact name.");
    await ctx.reply({ embeds: [info("Role information", `**Role:** ${role}\n**ID:** ${role.id}\n**Members:** ${role.members.size}\n**Position:** ${role.position}\n**Color:** ${role.hexColor}\n**Mentionable:** ${role.mentionable}`)] });
  }}),
  command({ name: "channelinfo", category: "General", usage: "[#channel]", description: "Show information about a channel.", async execute(ctx) {
    const channel = ctx.message.mentions.channels.first() || ctx.message.channel;
    await ctx.reply({ embeds: [info("Channel information", `**Channel:** ${channel}\n**ID:** ${channel.id}\n**Type:** ${channel.type}\n**Position:** ${channel.position ?? "n/a"}\n**Category:** ${channel.parent ? channel.parent.name : "None"}${channel.topic ? `\n**Topic:** ${channel.topic}` : ""}`)] });
  }}),
  command({ name: "invites", category: "General", staff: true, description: "List server invites the bot can access.", async execute(ctx) {
    const invites = await ctx.message.guild.invites.fetch();
    await ctx.reply({ embeds: [info("Server invites", invites.size ? invites.map((invite) => `\`${invite.code}\` — ${invite.uses || 0} uses — ${invite.inviter ? `<@${invite.inviter.id}>` : "unknown"}`).join("\n") : "No invites found.")] });
  }}),
  command({ name: "avatar", aliases: ["pfp"], category: "General", usage: "[@user]", description: "Show a user's avatar.", async execute(ctx) {
    const member = targetMember(ctx.message, ctx.args[0]) || ctx.message.member;
    await ctx.reply({ embeds: [info("Avatar", `[Open image](${member.displayAvatarURL({ size: 4096, extension: "png" })})`).setImage(member.displayAvatarURL({ size: 1024 }))] });
  }}),
  command({ name: "banner", category: "General", usage: "[@user]", description: "Show a user's banner when available.", async execute(ctx) {
    const user = await ctx.client.users.fetch(parseMentionOrId(ctx.args[0]) || ctx.message.author.id, { force: true });
    await ctx.reply(user.bannerURL({ size: 1024 }) ? { embeds: [info("Banner", `[Open image](${user.bannerURL({ size: 4096 })})`).setImage(user.bannerURL({ size: 1024 }))] } : { embeds: [warning("No banner", "That user does not have a public banner.")] });
  }}),
  command({ name: "membercount", aliases: ["members"], category: "General", description: "Show the member count.", async execute(ctx) {
    await ctx.reply({ embeds: [info("Member count", `${ctx.message.guild.memberCount} members are in this server.`)] });
  }}),
  command({ name: "roles", category: "General", description: "List server roles.", async execute(ctx) {
    const roles = ctx.message.guild.roles.cache.sort((a, b) => b.position - a.position).filter((r) => r.id !== ctx.message.guild.id).map((r) => `<@&${r.id}>`).slice(0, 80);
    await ctx.reply({ embeds: [info("Server roles", roles.join(" ") || "No roles found.")] });
  }}),
  command({ name: "channels", category: "General", description: "List server channels.", async execute(ctx) {
    const channels = ctx.message.guild.channels.cache.sort((a, b) => a.position - b.position).map((c) => `${c.type === ChannelType.GuildCategory ? "▰" : "•"} <#${c.id}>`).slice(0, 80);
    await ctx.reply({ embeds: [info("Server channels", channels.join("\n") || "No channels found.")] });
  }}),
  command({ name: "emojis", category: "General", description: "List custom emojis.", async execute(ctx) {
    await ctx.reply({ embeds: [info("Server emojis", ctx.message.guild.emojis.cache.map((e) => `${e} \`${e.name}\``).join(" ") || "No custom emojis found.")] });
  }}),
  command({ name: "stickers", category: "General", description: "List server stickers.", async execute(ctx) {
    await ctx.reply({ embeds: [info("Server stickers", ctx.message.guild.stickers.cache.map((s) => `[\`${s.name}\`](${s.url})`).join("\n") || "No stickers found.")] });
  }}),
  command({ name: "boosts", category: "General", description: "Show server boosts.", async execute(ctx) {
    await ctx.reply({ embeds: [info("Server boosts", `Level ${ctx.message.guild.premiumTier.replace("TIER_", "")} with ${ctx.message.guild.premiumSubscriptionCount || 0} boosts.`)] });
  }}),
  command({ name: "boosters", category: "General", description: "List server boosters.", async execute(ctx) {
    const boosters = ctx.message.guild.members.cache.filter((m) => m.premiumSince).map((m) => `<@${m.id}>`).join(", ");
    await ctx.reply({ embeds: [info("Server boosters", boosters || "No boosters found.")] });
  }}),
];

const moderation = [
  command({ name: "ban", aliases: ["hammer"], category: "Moderation", usage: "@user [reason]", permission: PermissionFlagsBits.BanMembers, staff: true, description: "Ban a member.", async execute(ctx) {
    const member = targetMember(ctx.message, ctx.args[0]);
    const hierarchy = hierarchyError(ctx.message.member, member, ctx.message.guild.members.me, "ban");
    if (hierarchy) return ctx.fail("Cannot ban member", hierarchy);
    const reason = cleanReason(ctx.args.slice(1).join(" "));
    await member.ban({ reason });
    await ctx.reply({ embeds: [success("Member banned", `<@${member.id}> was banned.\nReason: ${reason}`)] });
    await logAction(ctx, "Member banned", `<@${member.id}> by <@${ctx.message.author.id}>\nReason: ${reason}`);
  }}),
  command({ name: "unban", category: "Moderation", usage: "user_id [reason]", permission: PermissionFlagsBits.BanMembers, staff: true, description: "Unban a user ID.", async execute(ctx) {
    const id = parseMentionOrId(ctx.args[0]);
    if (!/^\d{15,22}$/.test(id || "")) return ctx.fail("User ID required", "Provide a valid Discord user ID.");
    await ctx.message.guild.members.unban(id, cleanReason(ctx.args.slice(1).join(" ")));
    await ctx.reply({ embeds: [success("User unbanned", `<@${id}> can join the server again.`)] });
  }}),
  command({ name: "kick", category: "Moderation", usage: "@user [reason]", permission: PermissionFlagsBits.KickMembers, staff: true, description: "Kick a member.", async execute(ctx) {
    const member = targetMember(ctx.message, ctx.args[0]);
    const hierarchy = hierarchyError(ctx.message.member, member, ctx.message.guild.members.me, "kick");
    if (hierarchy) return ctx.fail("Cannot kick member", hierarchy);
    const reason = cleanReason(ctx.args.slice(1).join(" "));
    await member.kick(reason);
    await ctx.reply({ embeds: [success("Member kicked", `<@${member.id}> was kicked.\nReason: ${reason}`)] });
    await logAction(ctx, "Member kicked", `<@${member.id}> by <@${ctx.message.author.id}>\nReason: ${reason}`);
  }}),
  command({ name: "timeout", aliases: ["mute"], category: "Moderation", usage: "@user duration [reason]", permission: PermissionFlagsBits.ModerateMembers, staff: true, description: "Timeout a member for up to 28 days.", async execute(ctx) {
    const member = targetMember(ctx.message, ctx.args[0]);
    const duration = parseDuration(ctx.args[1]);
    const hierarchy = hierarchyError(ctx.message.member, member, ctx.message.guild.members.me, "timeout");
    if (hierarchy || !duration) return ctx.fail("Invalid timeout", hierarchy || "Use a duration like `10m`, `2h`, or `1d`.");
    const reason = cleanReason(ctx.args.slice(2).join(" "));
    await member.timeout(duration, reason);
    await ctx.reply({ embeds: [success("Member timed out", `<@${member.id}> was timed out for \`${ctx.args[1]}\`.\nReason: ${reason}`)] });
  }}),
  command({ name: "untimeout", aliases: ["unmute"], category: "Moderation", usage: "@user", permission: PermissionFlagsBits.ModerateMembers, staff: true, description: "Remove a member timeout.", async execute(ctx) {
    const member = targetMember(ctx.message, ctx.args[0]);
    const hierarchy = hierarchyError(ctx.message.member, member, ctx.message.guild.members.me, "untimeout");
    if (hierarchy) return ctx.fail("Cannot untimeout member", hierarchy);
    await member.timeout(null, cleanReason(ctx.args.slice(1).join(" ")));
    await ctx.reply({ embeds: [success("Timeout removed", `<@${member.id}> can speak again.`)] });
  }}),
  command({ name: "warn", category: "Moderation", usage: "@user [reason]", staff: true, description: "Add a persistent warning.", async execute(ctx) {
    const member = targetMember(ctx.message, ctx.args[0]);
    if (!member) return ctx.fail("User not found", "Mention a valid member.");
    const reason = cleanReason(ctx.args.slice(1).join(" "));
    await ctx.db.addWarning(ctx.message.guild.id, member.id, ctx.message.author.id, reason);
    await ctx.reply({ embeds: [success("Warning added", `<@${member.id}> received a warning.\nReason: ${reason}`)] });
  }}),
  command({ name: "warnings", aliases: ["infractions"], category: "Moderation", usage: "[@user]", staff: true, description: "View persistent warnings.", async execute(ctx) {
    const member = targetMember(ctx.message, ctx.args[0]) || ctx.message.member;
    const warnings = await ctx.db.listWarnings(ctx.message.guild.id, member.id);
    await ctx.reply({ embeds: [info(`Warnings for ${member.user.username}`, warnings.length ? warnings.map((w, i) => `**${i + 1}.** ${w.reason} — <@${w.moderator_id}> <t:${Math.floor(new Date(w.created_at).getTime() / 1000)}:R>`).join("\n") : "No warnings found.")] });
  }}),
  command({ name: "clear", aliases: ["purge"], category: "Moderation", usage: "[amount]", permission: PermissionFlagsBits.ManageMessages, staff: true, description: "Delete recent messages.", async execute(ctx) {
    const count = amount(ctx.args[0]);
    if (!count) return ctx.fail("Invalid amount", "Choose a number from 1 to 100.");
    const deleted = await ctx.message.channel.bulkDelete(count, true);
    await ctx.reply({ embeds: [success("Messages cleared", `Deleted ${deleted.size} messages.`)], ephemeral: false });
  }}),
  command({ name: "lock", category: "Moderation", permission: PermissionFlagsBits.ManageChannels, staff: true, description: "Lock the current channel.", async execute(ctx) {
    await ctx.message.channel.permissionOverwrites.edit(ctx.message.guild.roles.everyone, { SendMessages: false });
    await ctx.reply({ embeds: [success("Channel locked", "Members can no longer send messages here.")] });
  }}),
  command({ name: "unlock", category: "Moderation", permission: PermissionFlagsBits.ManageChannels, staff: true, description: "Unlock the current channel.", async execute(ctx) {
    await ctx.message.channel.permissionOverwrites.edit(ctx.message.guild.roles.everyone, { SendMessages: null });
    await ctx.reply({ embeds: [success("Channel unlocked", "Members can send messages here again.")] });
  }}),
  command({ name: "lockdown", category: "Moderation", permission: PermissionFlagsBits.ManageChannels, staff: true, description: "Lock every text channel the bot can edit.", async execute(ctx) {
    const channels = ctx.message.guild.channels.cache.filter((channel) => channel.isTextBased() && channel.permissionOverwrites);
    let changed = 0;
    for (const channel of channels.values()) {
      if (!channel.permissionsFor(ctx.message.guild.members.me).has(PermissionFlagsBits.ManageChannels)) continue;
      await channel.permissionOverwrites.edit(ctx.message.guild.roles.everyone, { SendMessages: false }).then(() => changed++).catch(() => {});
    }
    await ctx.reply({ embeds: [success("Server lockdown enabled", `Locked ${changed} text channels.`)] });
  }}),
  command({ name: "softban", category: "Moderation", usage: "@user [reason]", permission: PermissionFlagsBits.BanMembers, staff: true, description: "Ban and immediately unban a member to remove recent messages.", async execute(ctx) {
    const member = targetMember(ctx.message, ctx.args[0]);
    const hierarchy = hierarchyError(ctx.message.member, member, ctx.message.guild.members.me, "softban");
    if (hierarchy) return ctx.fail("Cannot softban member", hierarchy);
    const reason = cleanReason(ctx.args.slice(1).join(" "));
    await member.ban({ deleteMessageSeconds: 604_800, reason });
    await ctx.message.guild.members.unban(member.id, "Softban release");
    await ctx.reply({ embeds: [success("Member softbanned", `<@${member.id}> was removed and can rejoin.\nReason: ${reason}`)] });
  }}),
  command({ name: "slowmode", category: "Moderation", usage: "seconds", permission: PermissionFlagsBits.ManageChannels, staff: true, description: "Set channel slowmode.", async execute(ctx) {
    const seconds = Number(ctx.args[0]);
    if (!Number.isInteger(seconds) || seconds < 0 || seconds > 21_600) return ctx.fail("Invalid slowmode", "Use a whole number from 0 to 21600.");
    await ctx.message.channel.setRateLimitPerUser(seconds);
    await ctx.reply({ embeds: [success("Slowmode updated", seconds ? `Slowmode is now ${seconds} seconds.` : "Slowmode disabled.")] });
  }}),
  command({ name: "nick", category: "Moderation", usage: "@user [nickname]", permission: PermissionFlagsBits.ManageNicknames, staff: true, description: "Change a member nickname.", async execute(ctx) {
    const member = targetMember(ctx.message, ctx.args[0]);
    const hierarchy = hierarchyError(ctx.message.member, member, ctx.message.guild.members.me, "edit");
    if (hierarchy) return ctx.fail("Cannot edit nickname", hierarchy);
    await member.setNickname(ctx.args.slice(1).join(" ") || null);
    await ctx.reply({ embeds: [success("Nickname updated", `<@${member.id}> now has the requested nickname.`)] });
  }}),
  command({ name: "role", category: "Moderation", usage: "@user role", permission: PermissionFlagsBits.ManageRoles, staff: true, description: "Toggle a role on a member.", async execute(ctx) {
    const member = targetMember(ctx.message, ctx.args[0]);
    const role = targetRole(ctx.message, ctx.args.slice(1).join(" "));
    if (!member || !role) return ctx.fail("Missing target", "Mention a member and provide a role name, mention, or ID.");
    if (role.position >= ctx.message.guild.members.me.roles.highest.position) return ctx.fail("Role hierarchy", "My highest role must be above that role.");
    if (role.position >= ctx.message.member.roles.highest.position && ctx.message.guild.ownerId !== ctx.message.author.id) return ctx.fail("Role hierarchy", "Your highest role must be above that role.");
    if (member.roles.cache.has(role.id)) await member.roles.remove(role);
    else await member.roles.add(role);
    await ctx.reply({ embeds: [success("Role updated", `${role} was ${member.roles.cache.has(role.id) ? "added to" : "removed from"} <@${member.id}>.`)] });
  }}),
];

const configuration = [
  command({ name: "setprefix", category: "Configuration", usage: "prefix", adminOnly: true, description: "Change this server's command prefix.", async execute(ctx) {
    const prefix = ctx.args[0];
    if (!prefix || prefix.length > 3 || /\s/.test(prefix)) return ctx.fail("Invalid prefix", "Use 1-3 non-whitespace characters.");
    await ctx.db.updateGuild(ctx.message.guild.id, { prefix });
    await ctx.reply({ embeds: [success("Prefix updated", `Commands now use \`${prefix}\` in this server.`)] });
  }}),
  command({ name: "logchannel", category: "Configuration", usage: "[#channel]", adminOnly: true, description: "Configure moderation logs.", async execute(ctx) {
    const channel = ctx.message.mentions.channels.first() || ctx.message.channel;
    await ctx.db.updateGuild(ctx.message.guild.id, { log_channel_id: channel.id });
    await ctx.reply({ embeds: [success("Log channel updated", `Moderation logs will be sent to ${channel}.`)] });
  }}),
  command({ name: "setwelcome", category: "Configuration", usage: "[#channel] [template]", adminOnly: true, description: "Configure welcome messages.", async execute(ctx) {
    const channel = ctx.message.mentions.channels.first() || ctx.message.channel;
    const template = ctx.args.filter((arg) => !arg.startsWith("<#")).join(" ") || "୨୧ Welcome {user} to **{server}**! You are member {membercount}.";
    await ctx.db.updateGuild(ctx.message.guild.id, { welcome_channel_id: channel.id, welcome_template: template });
    await ctx.reply({ embeds: [success("Welcome system updated", `Welcome messages will be sent to ${channel}.\nTemplate variables: {user}, {username}, {server}, {membercount}, {channel}`)] });
  }}),
  command({ name: "setdeletechannel", category: "Configuration", usage: "on|off", adminOnly: true, description: "Toggle command message deletion.", async execute(ctx) {
    const enabled = ctx.args[0]?.toLowerCase();
    if (!["on", "off"].includes(enabled)) return ctx.fail("Choose on or off", "Use `setdeletechannel on` or `setdeletechannel off`.");
    await ctx.db.updateGuild(ctx.message.guild.id, { delete_command_messages: enabled === "on" });
    await ctx.reply({ embeds: [success("Command deletion updated", `Command messages will ${enabled === "on" ? "" : "not "}be deleted.`)] });
  }}),
  command({ name: "setname", category: "Owner", usage: "name", ownerOnly: true, description: "Set the bot's global username.", async execute(ctx) {
    const name = ctx.args.join(" ").trim().slice(0, 32);
    if (!name) return ctx.fail("Name required", "Provide a nickname.");
    await ctx.client.user.setUsername(name);
    await ctx.reply({ embeds: [success("Global profile updated", `The bot's global username is now **${name}**.`)] });
  }}),
  command({ name: "servername", category: "Owner", usage: "name", ownerOnly: true, description: "Set the bot's nickname in this server.", async execute(ctx) {
    const name = ctx.args.join(" ").trim().slice(0, 32);
    if (!name) return ctx.fail("Name required", "Provide a server nickname.");
    await ctx.message.guild.members.me.setNickname(name);
    await ctx.reply({ embeds: [success("Server profile updated", `My nickname in this server is now **${name}**.`)] });
  }}),
  command({ name: "setavatar", category: "Owner", usage: "<image URL or attachment>", ownerOnly: true, description: "Set the bot's global avatar.", async execute(ctx) {
    const source = mediaSource(ctx.message, ctx.args);
    if (!source) return ctx.fail("Image required", "Attach an image or provide a public image URL.");
    await ctx.client.user.setAvatar(source);
    await ctx.reply({ embeds: [success("Global profile updated", "The bot's global avatar was updated.")] });
  }}),
  command({ name: "serveravatar", category: "Owner", usage: "<image URL or attachment>", ownerOnly: true, description: "Set the bot's avatar for this server only.", async execute(ctx) {
    const source = mediaSource(ctx.message, ctx.args);
    if (!source) return ctx.fail("Image required", "Attach an image or provide a public image URL.");
    await ctx.message.guild.members.editMe({ avatar: source });
    await ctx.reply({ embeds: [success("Server profile updated", "The bot's avatar for this server was updated.")] });
  }}),
  command({ name: "setbanner", category: "Owner", usage: "<image URL or attachment>", ownerOnly: true, description: "Set the bot's global banner.", async execute(ctx) {
    const source = mediaSource(ctx.message, ctx.args);
    if (!source) return ctx.fail("Image required", "Attach an image or provide a public image URL.");
    await ctx.client.user.setBanner(source);
    await ctx.reply({ embeds: [success("Global profile updated", "The bot's global banner was updated.")] });
  }}),
  command({ name: "serverbanner", category: "Owner", usage: "<image URL or attachment>", ownerOnly: true, description: "Set the bot's banner for this server only.", async execute(ctx) {
    const source = mediaSource(ctx.message, ctx.args);
    if (!source) return ctx.fail("Image required", "Attach an image or provide a public image URL.");
    await ctx.message.guild.members.editMe({ banner: source });
    await ctx.reply({ embeds: [success("Server profile updated", "The bot's banner for this server was updated.")] });
  }}),
  command({ name: "serverbio", category: "Owner", usage: "text", ownerOnly: true, description: "Set the bot's server-specific profile bio.", async execute(ctx) {
    const bio = ctx.args.join(" ").trim().slice(0, 190);
    if (!bio) return ctx.fail("Bio required", "Provide the server-specific profile bio.");
    await ctx.message.guild.members.editMe({ bio });
    await ctx.reply({ embeds: [success("Server profile updated", "The bot's server-specific bio was updated.")] });
  }}),
  command({ name: "setstatus", aliases: ["setpresence", "setactivity"], category: "Owner", usage: "playing|streaming|listening|watching|competing text [url] [online|idle|dnd|invisible]", ownerOnly: true, description: "Set the bot's profile activity and online status.", async execute(ctx) {
    const type = ctx.args[0]?.toLowerCase();
    const values = ctx.args.slice(1);
    let status = "online";
    if (presenceStatuses.has(values.at(-1)?.toLowerCase())) status = values.pop().toLowerCase();
    let url = null;
    if (type === "streaming" && /^https?:\/\/\S+$/i.test(values.at(-1) || "")) url = values.pop();
    const text = values.join(" ").trim();
    try {
      const normalized = normalizePresence({ type, text, status, url });
      await ctx.db.updateBotProfile(normalized);
      await applyStoredPresence(ctx.client, ctx.db);
      await ctx.reply({ embeds: [success("Bot status updated", `The bot now shows **${normalized.activity_type} ${normalized.activity_text}** with status **${normalized.presence_status}**.`)] });
    } catch (err) {
      await ctx.reply({ embeds: [error("Invalid bot status", err.message)] });
    }
  }}),
  command({ name: "clearstatus", category: "Owner", ownerOnly: true, description: "Remove the bot's profile activity.", async execute(ctx) {
    await ctx.db.updateBotProfile({ activity_text: null, activity_url: null });
    await applyStoredPresence(ctx.client, ctx.db);
    await ctx.reply({ embeds: [success("Bot status cleared", "The profile activity was removed.")] });
  }}),
  command({ name: "seteffect", category: "Owner", ownerOnly: true, description: "Explain Discord's profile-effect limitation.", async execute(ctx) {
    await ctx.reply({ embeds: [warning("Profile effect unavailable", "Discord's bot API does not currently expose a supported profile-effect endpoint.")] });
  }}),
  command({ name: "setcolor", category: "Owner", ownerOnly: true, description: "Explain Discord's profile-color limitation.", async execute(ctx) {
    await ctx.reply({ embeds: [warning("Profile color unavailable", "Discord's bot API does not currently expose a supported profile-color endpoint. Use the color-role system instead.")] });
  }}),
  command({ name: "alias", category: "Configuration", usage: "add|remove|list alias [command]", adminOnly: true, description: "Manage safe server-specific aliases.", async execute(ctx) {
    const action = ctx.args[0]?.toLowerCase();
    if (action === "list") {
      const aliases = await ctx.db.listAliases(ctx.message.guild.id);
      return ctx.reply({ embeds: [info("Custom aliases", aliases.length ? aliases.map((a) => `\`${a.alias}\` → \`${a.command_name}\``).join("\n") : "No custom aliases configured.")] });
    }
    const alias = ctx.args[1]?.toLowerCase();
    if (!alias || !/^[a-z0-9_-]{1,32}$/.test(alias)) return ctx.fail("Invalid alias", "Use letters, numbers, `_`, or `-`.");
    if (action === "remove") {
      await ctx.db.removeAlias(ctx.message.guild.id, alias);
      return ctx.reply({ embeds: [success("Alias removed", `\`${alias}\` was removed.`)] });
    }
    const target = ctx.commandMap.get(ctx.args[2]?.toLowerCase());
    if (action !== "add" || !target || target.ownerOnly || alias === target.name) return ctx.fail("Invalid alias target", "Use `alias add <alias> <implemented-command>`. Owner-only commands cannot be aliased.");
    await ctx.db.setAlias(ctx.message.guild.id, alias, target.name);
    await ctx.reply({ embeds: [success("Alias saved", `\`${alias}\` now runs \`${target.name}\`.`)] });
  }}),
  command({ name: "setroleperms", category: "Configuration", usage: "@role command... | clearperms", adminOnly: true, description: "Grant staff commands to a role.", async execute(ctx) {
    const role = ctx.message.mentions.roles.first() || targetRole(ctx.message, ctx.args[0]);
    if (!role) return ctx.fail("Role required", "Mention a role or provide its ID.");
    const clear = ctx.args.includes("clearperms");
    if (clear) {
      await ctx.db.clearRolePermissions(ctx.message.guild.id, role.id);
      return ctx.reply({ embeds: [success("Role permissions cleared", `${role} has no custom command permissions now.`)] });
    }
    const names = ctx.args.filter((arg) => !arg.startsWith("<@&") && arg !== role.id);
    const valid = names.filter((name) => commandPermissionNames.includes(name.toLowerCase()));
    if (!valid.length) return ctx.fail("No valid permissions", `Available: ${commandPermissionNames.join(", ")}`);
    for (const name of valid) await ctx.db.setRolePermission(ctx.message.guild.id, role.id, name.toLowerCase());
    await ctx.reply({ embeds: [success("Role permissions updated", `${role} can use: ${valid.join(", ")}`)] });
  }}),
  command({ name: "roleperms", category: "Configuration", adminOnly: true, description: "Explain configured role permissions.", async execute(ctx) {
    await ctx.reply({ embeds: [info("Role permissions", "Use `setroleperms @role lock unlock ...` to grant staff permissions. Administrator still does not grant blacklist access automatically.")] });
  }}),
];

const security = [
  command({ name: "blacklist", category: "Blacklist", usage: "@user | list", description: "Manage the persistent blacklist.", async execute(ctx) {
    if (!isBotOwner(ctx.message.author.id) && !(await ctx.db.roleHasPermission(ctx.message.guild.id, ctx.message.member, "blacklist"))) return ctx.fail("Blacklist permission required", "Administrator alone does not grant blacklist access.");
    if (ctx.args[0]?.toLowerCase() === "list") {
      const members = await ctx.db.listMembers("blacklist", ctx.message.guild.id);
      return ctx.reply({ embeds: [info("Blacklisted users", members.length ? members.map((m) => `<@${m.user_id}> — ${m.reason || "No reason"}`).join("\n") : "No blacklisted users.")] });
    }
    const member = targetMember(ctx.message, ctx.args[0]);
    const userId = member?.id || parseMentionOrId(ctx.args[0]);
    if (!/^\d{15,22}$/.test(userId || "")) return ctx.fail("User required", "Mention a member or provide a Discord user ID.");
    await ctx.db.setListMember("blacklist", ctx.message.guild.id, userId, ctx.message.author.id, cleanReason(ctx.args.slice(1).join(" ")));
    if (member?.kickable) await member.kick("Persistent server blacklist");
    await ctx.reply({ embeds: [success("User blacklisted", `<@${userId}> will be removed when detected in this server.`)] });
  }}),
  command({ name: "white", aliases: ["whitelist"], category: "Whitelist", usage: "@user", staff: true, description: "Add a user to the security whitelist.", async execute(ctx) {
    const member = targetMember(ctx.message, ctx.args[0]);
    const userId = member?.id || parseMentionOrId(ctx.args[0]);
    if (!/^\d{15,22}$/.test(userId || "")) return ctx.fail("User required", "Mention a member or provide a user ID.");
    await ctx.db.setListMember("whitelist", ctx.message.guild.id, userId, ctx.message.author.id);
    await ctx.reply({ embeds: [success("User whitelisted", `<@${userId}> is exempt from applicable security systems.`)] });
  }}),
  command({ name: "remove", category: "Blacklist", usage: "blacklist|white @user", staff: true, description: "Remove a user from a list.", async execute(ctx) {
    const list = ctx.args[0] === "white" ? "whitelist" : ctx.args[0] === "blacklist" ? "blacklist" : null;
    const userId = parseMentionOrId(ctx.args[1]);
    if (!list || !/^\d{15,22}$/.test(userId || "")) return ctx.fail("Invalid list removal", "Use `remove blacklist @user` or `remove white @user`.");
    if (list === "blacklist" && !isBotOwner(ctx.message.author.id) && !(await ctx.db.roleHasPermission(ctx.message.guild.id, ctx.message.member, "blacklist"))) {
      return ctx.fail("Blacklist permission required", "Administrator alone does not grant blacklist access.");
    }
    await ctx.db.removeListMember(list, ctx.message.guild.id, userId);
    await ctx.reply({ embeds: [success("List updated", `<@${userId}> was removed from the ${list}.`)] });
  }}),
  command({ name: "fullsec", category: "Security", adminOnly: true, description: "Enable audit-log anti-nuke protection.", async execute(ctx) {
    await ctx.db.updateGuild(ctx.message.guild.id, { full_security_enabled: !ctx.settings.full_security_enabled });
    await ctx.reply({ embeds: [success("Full security updated", `Audit-log protection is now ${ctx.settings.full_security_enabled ? "off" : "on"}.`)] });
  }}),
  command({ name: "status", category: "Security", adminOnly: true, description: "Show security status.", async execute(ctx) {
    const s = ctx.settings;
    await ctx.reply({ embeds: [info("Security status", `Full security: **${s.full_security_enabled ? "on" : "off"}**\nWord filter: **${s.word_filter_enabled ? "on" : "off"}**\nAnti-spam: **${s.anti_spam_enabled ? "on" : "off"}**\nLog channel: ${s.log_channel_id ? `<#${s.log_channel_id}>` : "not configured"}`)] });
  }}),
  command({ name: "limits", aliases: ["securitylimits"], category: "Security", adminOnly: true, description: "Show anti-nuke thresholds.", async execute(ctx) {
    await ctx.reply({ embeds: [info("Security limits", Object.entries(ctx.settings.security_limits || {}).map(([key, value]) => `**${key}:** ${value} actions / window`).join("\n"))] });
  }}),
  command({ name: "resetcounts", aliases: ["resetc​ounts"], category: "Security", adminOnly: true, description: "Reset in-memory anti-nuke counters.", async execute(ctx) {
    ctx.security.reset(ctx.message.guild.id);
    await ctx.reply({ embeds: [success("Security counters reset", "Current audit windows have been cleared.")] });
  }}),
  command({ name: "wordfilter", category: "Word Filter", usage: "on|off", adminOnly: true, description: "Toggle whole-word filtering.", async execute(ctx) {
    const value = ctx.args[0]?.toLowerCase();
    if (!["on", "off"].includes(value)) return ctx.fail("Choose on or off", "Use `wordfilter on` or `wordfilter off`.");
    await ctx.db.updateGuild(ctx.message.guild.id, { word_filter_enabled: value === "on" });
    await ctx.reply({ embeds: [success("Word filter updated", `Whole-word filtering is now ${value}.`)] });
  }}),
  command({ name: "addword", category: "Word Filter", usage: "word", adminOnly: true, description: "Add a filtered word.", async execute(ctx) {
    const word = ctx.args[0]?.toLowerCase();
    if (!word || word.length > 64 || !/^[\p{L}\p{N}'-]+$/u.test(word)) return ctx.fail("Invalid word", "Provide one plain whole word.");
    await ctx.db.addWord(ctx.message.guild.id, word);
    await ctx.reply({ embeds: [success("Word added", `\`${word}\` will be filtered when the system is on.`)] });
  }}),
  command({ name: "removeword", category: "Word Filter", usage: "word", adminOnly: true, description: "Remove a filtered word.", async execute(ctx) {
    await ctx.db.removeWord(ctx.message.guild.id, ctx.args[0]?.toLowerCase());
    await ctx.reply({ embeds: [success("Word removed", "The word was removed from the filter.")] });
  }}),
  command({ name: "wordlist", category: "Word Filter", adminOnly: true, description: "List filtered words.", async execute(ctx) {
    const words = await ctx.db.getWords(ctx.message.guild.id);
    await ctx.reply({ embeds: [info("Filtered words", words.length ? words.map((word) => `\`${word}\``).join(", ") : "No filtered words configured.")] });
  }}),
  command({ name: "antispam", category: "Anti-Spam", usage: "on|off", adminOnly: true, description: "Toggle rapid-message protection.", async execute(ctx) {
    const value = ctx.args[0]?.toLowerCase();
    if (!["on", "off"].includes(value)) return ctx.fail("Choose on or off", "Use `antispam on` or `antispam off`.");
    await ctx.db.updateGuild(ctx.message.guild.id, { anti_spam_enabled: value === "on" });
    await ctx.reply({ embeds: [success("Anti-spam updated", `Rapid-message protection is now ${value}.`)] });
  }}),
  command({ name: "snipe", category: "Security", usage: "[#channel]", staff: true, description: "Show the latest deleted message.", async execute(ctx) {
    const channel = ctx.message.mentions.channels.first() || ctx.message.channel;
    const entry = ctx.snipes.get(channel.id);
    if (!entry) return ctx.fail("Nothing to snipe", "No deleted message is stored for that channel.");
    await ctx.reply({ embeds: [info("Deleted message", `**Author:** <@${entry.authorId}>\n**Channel:** ${channel}\n**Content:** ${entry.content || "No text"}\n**Deleted:** <t:${Math.floor(entry.createdAt / 1000)}:R>`).setImage(entry.attachment || null)] });
  }}),
];

const systems = [
  command({ name: "jail", category: "Jail", usage: "@user [reason]", staff: true, description: "Remove roles and apply the configured jail role.", async execute(ctx) {
    const member = targetMember(ctx.message, ctx.args[0]);
    const role = ctx.settings.jail_role_id && ctx.message.guild.roles.cache.get(ctx.settings.jail_role_id);
    const hierarchy = hierarchyError(ctx.message.member, member, ctx.message.guild.members.me, "jail");
    if (hierarchy || !role) return ctx.fail("Jail is not configured", hierarchy || "Run `setjail @role [#channel]` first.");
    const previous = member.roles.cache.filter((r) => r.id !== ctx.message.guild.id && r.editable && r.id !== role.id).map((r) => r.id);
    await ctx.db.saveJail(ctx.message.guild.id, member.id, previous, cleanReason(ctx.args.slice(1).join(" ")));
    await member.roles.remove(previous);
    await member.roles.add(role);
    await ctx.reply({ embeds: [success("Member jailed", `<@${member.id}> was jailed.`)] });
  }}),
  command({ name: "unjail", category: "Jail", usage: "@user", staff: true, description: "Remove jail and restore stored roles.", async execute(ctx) {
    const member = targetMember(ctx.message, ctx.args[0]);
    const record = member && await ctx.db.getJail(ctx.message.guild.id, member.id);
    if (!member || !record) return ctx.fail("No jail record", "That member does not have a stored jail record.");
    const role = ctx.settings.jail_role_id && ctx.message.guild.roles.cache.get(ctx.settings.jail_role_id);
    if (role) await member.roles.remove(role).catch(() => {});
    const validRoles = record.previous_role_ids.filter((id) => ctx.message.guild.roles.cache.has(id));
    if (validRoles.length) await member.roles.add(validRoles).catch(() => {});
    await ctx.db.removeJail(ctx.message.guild.id, member.id);
    await ctx.reply({ embeds: [success("Member unjailed", `Restored ${validRoles.length} previous roles for <@${member.id}>.`)] });
  }}),
  command({ name: "setjail", category: "Jail", usage: "@role [#channel]", adminOnly: true, description: "Configure the jail role and optional jail channel.", async execute(ctx) {
    const role = ctx.message.mentions.roles.first() || targetRole(ctx.message, ctx.args[0]);
    const channel = ctx.message.mentions.channels.first();
    if (!role) return ctx.fail("Jail role required", "Mention the role to apply to jailed members.");
    await ctx.db.updateGuild(ctx.message.guild.id, { jail_role_id: role.id, jail_channel_id: channel?.id || null });
    await ctx.reply({ embeds: [success("Jail configured", `Jail role: ${role}${channel ? `\nJail channel: ${channel}` : ""}`)] });
  }}),
  command({ name: "rank", category: "Leveling", usage: "[@user]", description: "Show a member's level and XP.", async execute(ctx) {
    const member = targetMember(ctx.message, ctx.args[0]) || ctx.message.member;
    const record = await ctx.db.getXp(ctx.message.guild.id, member.id);
    const level = levelFromXp(record.points);
    await ctx.reply({ embeds: [info(`${member.user.username}'s rank`, `**Level:** ${level}\n**XP:** ${record.points}\n**Progress:** ${record.points - xpForLevel(level)} / ${xpForLevel(level + 1) - xpForLevel(level)}`).setThumbnail(member.displayAvatarURL({ size: 256 }))] });
  }}),
  command({ name: "leaderboard", aliases: ["top"], category: "Leveling", description: "Show the XP leaderboard.", async execute(ctx) {
    const rows = await ctx.db.leaderboard(ctx.message.guild.id);
    await ctx.reply({ embeds: [info("XP leaderboard", rows.length ? rows.map((row, i) => `**${i + 1}.** <@${row.user_id}> — ${row.points} XP (level ${levelFromXp(row.points)})`).join("\n") : "No XP has been earned yet.")] });
  }}),
  command({ name: "setlevelrole", category: "Leveling", usage: "level @role", adminOnly: true, description: "Set an automatic level role.", async execute(ctx) {
    const level = Number(ctx.args[0]);
    const role = ctx.message.mentions.roles.first() || targetRole(ctx.message, ctx.args[1]);
    if (!Number.isInteger(level) || level < 1 || !role) return ctx.fail("Invalid level role", "Use `setlevelrole 5 @Role`.");
    await ctx.db.setLevelRole(ctx.message.guild.id, level, role.id);
    await ctx.reply({ embeds: [success("Level role saved", `Level ${level} rewards ${role}.`)] });
  }}),
  command({ name: "removelevelrole", category: "Leveling", usage: "level", adminOnly: true, description: "Remove an automatic level role.", async execute(ctx) {
    const level = Number(ctx.args[0]);
    if (!Number.isInteger(level) || level < 1) return ctx.fail("Invalid level", "Provide a positive level.");
    await ctx.db.removeLevelRole(ctx.message.guild.id, level);
    await ctx.reply({ embeds: [success("Level role removed", `The reward for level ${level} was removed.`)] });
  }}),
  command({ name: "levelroles", category: "Leveling", adminOnly: true, description: "List automatic level roles.", async execute(ctx) {
    const rows = await ctx.db.getLevelRoles(ctx.message.guild.id);
    await ctx.reply({ embeds: [info("Level roles", rows.length ? rows.map((row) => `Level ${row.level}: <@&${row.role_id}>`).join("\n") : "No level roles configured.")] });
  }}),
  command({ name: "resetxp", category: "Leveling", usage: "@user", adminOnly: true, description: "Reset a member's XP.", async execute(ctx) {
    const member = targetMember(ctx.message, ctx.args[0]);
    if (!member) return ctx.fail("User not found", "Mention a valid member.");
    await ctx.db.resetXp(ctx.message.guild.id, member.id);
    await ctx.reply({ embeds: [success("XP reset", `<@${member.id}>'s XP was reset.`)] });
  }}),
  command({ name: "setlevelchannel", category: "Leveling", usage: "[#channel]", adminOnly: true, description: "Restrict level-up messages to a channel.", async execute(ctx) {
    const channel = ctx.message.mentions.channels.first() || ctx.message.channel;
    await ctx.db.updateGuild(ctx.message.guild.id, { level_channel_id: channel.id });
    await ctx.reply({ embeds: [success("Level channel updated", `Level-up messages will use ${channel}.`)] });
  }}),
  command({ name: "setcounting", category: "Counting", usage: "[#channel]", adminOnly: true, description: "Configure the counting channel.", async execute(ctx) {
    const channel = ctx.message.mentions.channels.first() || ctx.message.channel;
    await ctx.db.updateGuild(ctx.message.guild.id, { counting_channel_id: channel.id, counting_value: 0, counting_last_user_id: null });
    await ctx.reply({ embeds: [success("Counting configured", `Counting starts at 1 in ${channel}.`)] });
  }}),
  command({ name: "counting", category: "Counting", adminOnly: true, description: "Show counting status.", async execute(ctx) {
    await ctx.reply({ embeds: [info("Counting status", ctx.settings.counting_channel_id ? `Channel: <#${ctx.settings.counting_channel_id}>\nCurrent count: ${ctx.settings.counting_value}` : "Counting is not configured.")] });
  }}),
  command({ name: "setemojichannel", category: "Emoji/Sticker", usage: "[#channel]", adminOnly: true, description: "Configure the emoji/sticker stealing channel.", async execute(ctx) {
    const channel = ctx.message.mentions.channels.first() || ctx.message.channel;
    await ctx.db.updateGuild(ctx.message.guild.id, { emoji_channel_id: channel.id });
    await ctx.reply({ embeds: [success("Emoji channel updated", `Custom emoji and sticker detection is enabled in ${channel}. Discord API limits still apply.`)] });
  }}),
  command({ name: "setcolors", category: "Roles", usage: "[#channel] name:#hex ...", adminOnly: true, description: "Create a persistent numbered color-role panel.", async execute(ctx) {
    const channel = ctx.message.mentions.channels.first() || ctx.message.channel;
    const definitions = ctx.args.filter((arg) => !arg.startsWith("<#"));
    if (!definitions.length) return ctx.fail("Color definitions required", "Use entries such as `pink:#ff8fab blue:#8ecae6`.");
    const created = [];
    for (const definition of definitions.slice(0, 20)) {
      const match = /^([^:]{1,30}):#?([0-9a-f]{6})$/i.exec(definition);
      if (!match) continue;
      const role = await ctx.message.guild.roles.create({ name: `color-${match[1]}`, color: match[2], reason: "Color-role system setup" }).catch(() => null);
      if (!role) continue;
      const number = created.length + 1;
      await ctx.db.saveColorRole(ctx.message.guild.id, number, role.id, match[1], `#${match[2].toLowerCase()}`);
      created.push(`${number}. ${match[1]} — ${role}`);
    }
    if (!created.length) return ctx.fail("No valid colors", "Use entries such as `pink:#ff8fab blue:#8ecae6`.");
    await ctx.db.updateGuild(ctx.message.guild.id, { color_channel_id: channel.id });
    await channel.send({ embeds: [info("Choose a color", `${created.join("\n")}\n\nSend the number for your choice in this channel.`)] });
    await ctx.reply({ embeds: [success("Color panel created", `Configured ${created.length} color roles in ${channel}.`)] });
  }}),
  command({ name: "colors", category: "Roles", description: "Show the color-role panel configuration.", async execute(ctx) {
    const roles = await ctx.db.getColorRoles(ctx.message.guild.id);
    await ctx.reply({ embeds: [info("Color roles", roles.length ? roles.map((role) => `**${role.number}.** ${role.role_name} — <@&${role.role_id}> \`${role.hex}\``).join("\n") : "No color roles configured.")] });
  }}),
  command({ name: "setupticket", category: "Tickets", usage: "[category]", adminOnly: true, description: "Create a ticket panel and configure ticket category.", async execute(ctx) {
    const category = ctx.message.mentions.channels.first() || ctx.message.guild.channels.cache.find((c) => c.type === ChannelType.GuildCategory && c.name.toLowerCase() === ctx.args.join(" ").toLowerCase());
    if (category && category.type !== ChannelType.GuildCategory) return ctx.fail("Category required", "Mention a category channel.");
    await ctx.db.updateGuild(ctx.message.guild.id, { ticket_category_id: category?.id || null });
    const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("ticket:create").setLabel("Open ticket").setStyle(ButtonStyle.Secondary));
    await ctx.message.channel.send({ embeds: [info("Support tickets", "Click the button below to create a private support ticket.")], components: [row] });
    await ctx.reply({ embeds: [success("Ticket panel created", "The panel is ready in this channel.")] });
  }}),
  command({ name: "close", category: "Tickets", description: "Close the current ticket.", async execute(ctx) {
    if (!ctx.message.channel.topic?.startsWith("ticket-owner:")) return ctx.fail("Not a ticket", "This command can only be used inside a ticket channel.");
    const ownerId = ctx.message.channel.topic.slice("ticket-owner:".length);
    if (ctx.message.author.id !== ownerId && !isServerAdmin(ctx.message.member) && !(await ctx.db.roleHasPermission(ctx.message.guild.id, ctx.message.member, "ticket"))) {
      return ctx.fail("Permission denied", "Only the ticket owner or configured ticket staff can close this ticket.");
    }
    await ctx.reply({ embeds: [success("Ticket closing", "This ticket will be deleted in 5 seconds.")] });
    setTimeout(() => ctx.message.channel.delete("Ticket closed").catch(() => {}), 5_000);
  }}),
  command({ name: "backup", category: "Backup", adminOnly: true, description: "Save a portable snapshot of supported server configuration.", async execute(ctx) {
    const g = ctx.message.guild;
    const payload = {
      version: 1,
      guild: { name: g.name, verificationLevel: g.verificationLevel, defaultMessageNotifications: g.defaultMessageNotifications },
      roles: g.roles.cache.filter((r) => r.id !== g.id).sort((a, b) => a.position - b.position).map((r) => ({ name: r.name, color: r.hexColor, permissions: r.permissions.bitfield.toString(), hoist: r.hoist, mentionable: r.mentionable })),
      channels: g.channels.cache.sort((a, b) => a.position - b.position).map((c) => ({ name: c.name, type: c.type, parent: c.parent?.name || null, topic: c.topic || null, nsfw: c.nsfw, rateLimitPerUser: c.rateLimitPerUser })),
      botSettings: ctx.settings,
    };
    const saved = await ctx.db.saveBackup(g.id, ctx.message.author.id, payload);
    await ctx.reply({ embeds: [success("Backup saved", `Backup #${saved.id} saved. It includes supported roles, channels, server settings, and bot settings. Discord does not allow bots to export every object or message.`)] });
  }}),
  command({ name: "import", category: "Backup", adminOnly: true, usage: "[backup_id]", description: "Restore missing roles and channels from a saved backup.", async execute(ctx) {
    const backup = await ctx.db.getBackup(ctx.message.guild.id, ctx.args[0] ? Number(ctx.args[0]) : null);
    if (!backup) return ctx.fail("Backup not found", "Provide a saved backup ID, or create a backup first.");
    const payload = backup.payload;
    let rolesCreated = 0;
    for (const savedRole of [...(payload.roles || [])].reverse()) {
      if (ctx.message.guild.roles.cache.some((role) => role.name === savedRole.name)) continue;
      await ctx.message.guild.roles.create({
        name: savedRole.name,
        color: savedRole.color,
        permissions: BigInt(savedRole.permissions || "0"),
        hoist: savedRole.hoist,
        mentionable: savedRole.mentionable,
        reason: `Restore backup #${backup.id}`,
      }).then(() => rolesCreated++).catch(() => {});
    }
    let channelsCreated = 0;
    for (const savedChannel of payload.channels || []) {
      if (ctx.message.guild.channels.cache.some((channel) => channel.name === savedChannel.name && channel.type === savedChannel.type)) continue;
      await ctx.message.guild.channels.create({
        name: savedChannel.name,
        type: savedChannel.type,
        topic: savedChannel.topic || undefined,
        nsfw: savedChannel.nsfw,
        rateLimitPerUser: savedChannel.rateLimitPerUser,
        reason: `Restore backup #${backup.id}`,
      }).then(() => channelsCreated++).catch(() => {});
    }
    await ctx.reply({ embeds: [success("Backup imported", `Restored ${rolesCreated} roles and ${channelsCreated} channels from backup #${backup.id}. Existing objects were preserved; permission overwrites and unsupported Discord data were not blindly replaced.`)] });
  }}),
];

const owner = [
  command({ name: "cmds", aliases: ["cmd", "commands", "help"], category: "General", adminOnly: true, description: "DM the private command catalog.", async execute(ctx) {
    const ownerView = isBotOwner(ctx.message.author.id);
    const groups = new Map();
    for (const cmd of new Set(ctx.commandMap.values())) {
      if (cmd.ownerOnly && !ownerView) continue;
      if (!groups.has(cmd.category)) groups.set(cmd.category, []);
      groups.get(cmd.category).push(`\`${ctx.prefix}${cmd.name}${cmd.usage ? ` ${cmd.usage}` : ""}\` — ${cmd.description}${cmd.aliases?.length ? ` (aliases: ${cmd.aliases.map((a) => `${ctx.prefix}${a}`).join(", ")})` : ""}`);
    }
    const pages = [];
    let current = "";
    for (const [category, entries] of groups) {
      const block = `**${category}**\n${entries.join("\n")}`;
      if ((current + block).length > 3800) { pages.push(current); current = ""; }
      current += `${current ? "\n\n" : ""}${block}`;
    }
    if (current) pages.push(current);
    try {
      await ctx.message.author.send({ embeds: [info("Command center", `Private command catalog for **${ctx.message.guild.name}**.\nCurrent prefix: \`${ctx.prefix}\`\nUse \`${ctx.prefix}help\` any time to reopen this panel.`)] });
      for (const [index, page] of pages.entries()) await ctx.message.author.send({ embeds: [embed(`Command catalog ${pages.length > 1 ? `${index + 1}/${pages.length}` : ""}`, page)] });
      await ctx.message.delete();
      await ctx.message.channel.send({ embeds: [success("Got it!!", "Sent the commands in your DMs 📨!")] });
    } catch {
      await ctx.fail("DMs are closed", "Enable direct messages from server members, then run the command again.");
    }
  }}),
];

export const allCommands = [...general, ...moderation, ...configuration, ...security, ...systems, ...owner];
export const commandMap = new Map();
for (const cmd of allCommands) {
  commandMap.set(cmd.name, cmd);
  for (const alias of cmd.aliases || []) commandMap.set(alias, cmd);
}

export async function executeCommand(message, client, db, state) {
  if (!message.guild || message.author.bot) return;
  const settings = await db.ensureGuild(message.guild.id);
  const prefix = settings.prefix;
  if (message.mentions.has(client.user) && message.content.trim() === `<@${client.user.id}>`) {
    await message.reply({ embeds: [info("hello!!", `My server prefix is \`${prefix}\``)] });
    return;
  }
  if (!message.content.startsWith(prefix)) return;
  const [rawName, ...args] = tokenize(message.content.slice(prefix.length).trim());
  if (!rawName) return;
  const aliasTarget = await db.getAlias(message.guild.id, rawName.toLowerCase());
  const cmd = commandMap.get((aliasTarget || rawName).toLowerCase());
  if (!cmd) return;
  const ctx = {
    message, client, db, args, prefix, settings, commandMap, snipes: state.snipes,
    security: state.security,
    reply: (payload) => message.reply(payload),
    fail: (title, description) => message.reply({ embeds: [error(title, description)] }),
  };
  if (!(await canUse(message, cmd, db))) return ctx.fail("Permission denied", "You do not have permission to use this command.");
  const key = `${message.guild.id}:${message.author.id}:${cmd.name}`;
  const now = Date.now();
  const until = state.cooldowns.get(key) || 0;
  if (until > now) return ctx.fail("Slow down", `Try again in ${Math.ceil((until - now) / 1000)} seconds.`);
  state.cooldowns.set(key, now + (cmd.category === "General" ? 2_000 : 4_000));
  try {
    await cmd.execute(ctx);
    if (settings.delete_command_messages && message.deletable && cmd.name !== "cmds") await message.delete().catch(() => {});
  } catch (err) {
    console.error(`[command:${cmd.name}]`, err);
    await ctx.fail("Something went wrong", failureMessage(err));
  }
}