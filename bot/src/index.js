import { Client, GatewayIntentBits, Partials, Events } from "discord.js";
import { assertConfig, config } from "./config.js";
import { Database } from "./db.js";
import { allCommands, executeCommand } from "./commands.js";
import { SecurityService } from "./security.js";
import { error, info, success } from "./embeds.js";
import { renderTemplate, levelFromXp } from "./utils.js";
import { handlePanelButton, handleSlashInteraction, registerSlashCommands, slashDefinitions } from "./slash.js";

assertConfig();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildPresences,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});
const db = new Database();
const state = {
  cooldowns: new Map(),
  snipes: new Map(),
  security: new SecurityService(db),
  messages: new Map(),
};

client.once(Events.ClientReady, async (ready) => {
  console.info(`Logged in as ${ready.user.tag} in ${client.guilds.cache.size} servers`);
  ready.user.setPresence({ activities: [{ name: "server protection" }], status: "online" });
  await registerSlashCommands(client);
});

client.on(Events.GuildCreate, async (guild) => {
  await guild.commands.set(slashDefinitions.map((command) => command.toJSON())).catch((err) => {
    console.error(`[slash-register:${guild.id}]`, err);
  });
});

client.on(Events.MessageCreate, async (message) => {
  try {
    if (message.author.bot || !message.guild) return;
    const settings = await db.ensureGuild(message.guild.id);
    const handled = await state.security.monitorMessage(message, settings, state);
    if (handled) return;
    if (settings.color_channel_id === message.channel.id && /^\d+$/.test(message.content.trim())) {
      const choice = Number(message.content.trim());
      const colorRoles = await db.getColorRoles(message.guild.id);
      const selected = colorRoles.find((role) => role.number === choice);
      if (selected) {
        const colorRoleIds = new Set(colorRoles.map((role) => role.role_id));
        const previous = [...message.member.roles.cache.filter((role) => colorRoleIds.has(role.id)).keys()];
        await message.member.roles.remove(previous).catch(() => {});
        await message.member.roles.add(selected.role_id).catch(() => {});
        await message.delete().catch(() => {});
        await message.react("✅").catch(() => {});
        return;
      }
    }
    if (settings.emoji_channel_id === message.channel.id) {
      const emojiMatches = [...message.content.matchAll(/<(a?):([a-zA-Z0-9_]{2,32}):(\d+)>/g)];
      let copied = 0;
      let failed = false;
      for (const [, animated, name, id] of emojiMatches.slice(0, 10)) {
        if (message.guild.emojis.cache.some((emoji) => emoji.name === name)) continue;
        const url = `https://cdn.discordapp.com/emojis/${id}.${animated ? "gif" : "png"}`;
        const created = await message.guild.emojis.create({ attachment: url, name }).catch(() => null);
        if (created) copied += 1;
        else failed = true;
      }
      for (const sticker of message.stickers.values()) {
        const created = await message.guild.stickers.create({
          file: sticker.url,
          name: sticker.name.slice(0, 30),
          tags: sticker.tags || sticker.name.slice(0, 200),
          description: `Copied from ${message.guild.name}`.slice(0, 100),
          reason: "Emoji/sticker channel",
        }).catch(() => null);
        if (created) copied += 1;
        else failed = true;
      }
      if (emojiMatches.length || message.stickers.size) await message.react(copied && !failed ? "✅" : "❌").catch(() => {});
    }
    if (settings.level_channel_id !== message.channel.id) {
      const record = await db.getXp(message.guild.id, message.author.id);
      const previousLevel = levelFromXp(record.points);
      const amount = Math.floor(Math.random() * (settings.xp_max - settings.xp_min + 1)) + settings.xp_min;
      const lastXp = record.last_xp_at ? new Date(record.last_xp_at).getTime() : 0;
      if (Date.now() - lastXp >= settings.xp_cooldown_seconds * 1000) {
        const updated = await db.addXp(message.guild.id, message.author.id, amount);
        const newLevel = levelFromXp(updated.points);
        if (newLevel > previousLevel) {
          const channel = settings.level_channel_id ? message.guild.channels.cache.get(settings.level_channel_id) : message.channel;
          if (channel?.isTextBased()) await channel.send({ embeds: [success("Level up", `<@${message.author.id}> reached level **${newLevel}**!`)] }).catch(() => {});
          for (const reward of await db.getLevelRoles(message.guild.id)) {
            if (reward.level <= newLevel) await message.member.roles.add(reward.role_id).catch(() => {});
          }
        }
      }
    }
    await executeCommand(message, client, db, state);
  } catch (err) {
    console.error("[messageCreate]", err);
  }
});

client.on(Events.MessageDelete, (message) => {
  if (!message.guild || message.author?.bot) return;
  state.snipes.set(message.channel.id, {
    authorId: message.author?.id || "unknown",
    content: message.content || "",
    attachment: message.attachments?.first()?.url,
    createdAt: Date.now(),
  });
});

client.on(Events.GuildMemberAdd, async (member) => {
  try {
    if (await db.hasListMember("blacklist", member.guild.id, member.id)) {
      if (member.kickable) await member.kick("Persistent server blacklist");
      return;
    }
    const jail = await db.getJail(member.guild.id, member.id);
    const settings = await db.getGuild(member.guild.id);
    if (jail && settings.jail_role_id) await member.roles.add(settings.jail_role_id, "Reapplying persistent jail").catch(() => {});
    if (settings.welcome_channel_id) {
      const channel = member.guild.channels.cache.get(settings.welcome_channel_id);
      if (channel?.isTextBased()) await channel.send({ embeds: [info("Welcome", renderTemplate(settings.welcome_template || "୨୧ Welcome {user} to **{server}**!", member))] }).catch(() => {});
    }
  } catch (err) {
    console.error("[guildMemberAdd]", err);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) await handleSlashInteraction(interaction, db);
    else if (interaction.isButton()) await handlePanelButton(interaction, db);
  } catch (err) {
    console.error("[interaction]", err);
    const reply = { embeds: [error("Something went wrong", "Discord rejected that interaction. Check the bot permissions and panel configuration.")], ephemeral: true };
    if (interaction.replied || interaction.deferred) await interaction.followUp(reply).catch(() => {});
    else await interaction.reply(reply).catch(() => {});
  }
});

const shutdown = async (signal) => {
  console.info(`${signal} received, shutting down`);
  client.destroy();
  await db.close().catch((err) => console.error("[shutdown]", err));
  process.exit(0);
};
process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
process.on("unhandledRejection", (reason) => console.error("[unhandledRejection]", reason));
process.on("uncaughtException", (errorValue) => {
  console.error("[uncaughtException]", errorValue);
  process.exitCode = 1;
});

await db.init();
console.info("Database schema ready");
await client.login(config.token);