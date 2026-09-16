import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
} from "discord.js";
import { error, info, success } from "./embeds.js";
import { isBotOwner, isServerAdmin } from "./permissions.js";

const adminPermissions = PermissionFlagsBits.Administrator.toString();
const ticketButtonStyles = {
  grey: ButtonStyle.Secondary,
  gray: ButtonStyle.Secondary,
  blue: ButtonStyle.Primary,
  green: ButtonStyle.Success,
  red: ButtonStyle.Danger,
};

const optionalText = (option, name, description, maxLength = 1000) =>
  option
    .addStringOption((input) =>
      input.setName(name).setDescription(description).setMaxLength(maxLength).setRequired(false),
    );

const panelOptions = (command, includeCategory = false, requiredChannel = true) => {
  command.addChannelOption((option) =>
    option
      .setName("channel")
      .setDescription("Channel where the panel should be sent")
      .addChannelTypes(ChannelType.GuildText)
      .setRequired(requiredChannel),
  );
  if (includeCategory) {
    command.addChannelOption((option) =>
      option
        .setName("category")
        .setDescription("Category for newly created tickets")
        .addChannelTypes(ChannelType.GuildCategory)
        .setRequired(false),
    );
  }
  return command;
};

const addTicketOptions = (subcommand, { includeRequiredReasons = false } = {}) => {
  optionalText(subcommand, "reasons", "label|description|emoji;label|description|emoji", 2000);
  subcommand.addStringOption((option) =>
    option
      .setName("button_color")
      .setDescription("Button color")
      .addChoices(
        { name: "Grey", value: "grey" },
        { name: "Blue", value: "blue" },
        { name: "Green", value: "green" },
        { name: "Red", value: "red" },
      )
      .setRequired(false),
  );
  optionalText(subcommand, "button_emoji", "Unicode emoji or server emoji such as <:cart:123456789>", 100);
  optionalText(subcommand, "menu_placeholder", "Text shown before a ticket reason is selected", 150);
  return subcommand;
};

const ticketCreate = new SlashCommandBuilder()
  .setName("ticketpanel")
  .setDescription("Create and edit an interactive ticket panel.")
  .setDefaultMemberPermissions(adminPermissions)
  .addSubcommand((subcommand) => {
    subcommand.setName("create").setDescription("Create a ticket panel.");
    panelOptions(subcommand, true);
    optionalText(subcommand, "title", "Panel title", 256);
    optionalText(subcommand, "description", "Panel description", 4000);
    optionalText(subcommand, "button", "Button label", 80);
    optionalText(subcommand, "opening_title", "Title used inside each new ticket", 256);
    optionalText(subcommand, "opening_description", "Message used inside each new ticket", 4000);
    optionalText(subcommand, "opening_image", "Large image URL used inside each new ticket", 1000);
    optionalText(subcommand, "opening_thumbnail", "Thumbnail URL used inside each new ticket", 1000);
    optionalText(subcommand, "color", "Hex color such as #18181b", 7);
    optionalText(subcommand, "image", "Public image URL", 1000);
    optionalText(subcommand, "thumbnail", "Public thumbnail URL", 1000);
    addTicketOptions(subcommand, { includeRequiredReasons: true });
    return subcommand;
  })
  .addSubcommand((subcommand) => {
    subcommand.setName("edit").setDescription("Edit the saved ticket panel.");
    panelOptions(subcommand, true, false);
    optionalText(subcommand, "title", "Panel title", 256);
    optionalText(subcommand, "description", "Panel description", 4000);
    optionalText(subcommand, "button", "Button label", 80);
    optionalText(subcommand, "opening_title", "Title used inside each new ticket", 256);
    optionalText(subcommand, "opening_description", "Message used inside each new ticket", 4000);
    optionalText(subcommand, "opening_image", "Large image URL used inside each new ticket", 1000);
    optionalText(subcommand, "opening_thumbnail", "Thumbnail URL used inside each new ticket", 1000);
    optionalText(subcommand, "color", "Hex color such as #18181b", 7);
    optionalText(subcommand, "image", "Public image URL", 1000);
    optionalText(subcommand, "thumbnail", "Public thumbnail URL", 1000);
    addTicketOptions(subcommand);
    return subcommand;
  });

const colorPanel = new SlashCommandBuilder()
  .setName("colorpanel")
  .setDescription("Create and edit an interactive color-role panel.")
  .setDefaultMemberPermissions(adminPermissions)
  .addSubcommand((subcommand) => {
    subcommand.setName("create").setDescription("Create a color-role panel.");
    panelOptions(subcommand);
    subcommand.addStringOption((option) =>
      option.setName("colors").setDescription("Colors like pink:#ff8fab blue:#8ecae6").setMaxLength(1000).setRequired(true),
    );
    optionalText(subcommand, "title", "Panel title", 256);
    optionalText(subcommand, "description", "Panel description", 4000);
    optionalText(subcommand, "image", "Public image URL", 1000);
    optionalText(subcommand, "thumbnail", "Public thumbnail URL", 1000);
    return subcommand;
  })
  .addSubcommand((subcommand) => {
    subcommand.setName("edit").setDescription("Edit the saved color-role panel.");
    panelOptions(subcommand, false, false);
    optionalText(subcommand, "colors", "Optional new colors like pink:#ff8fab blue:#8ecae6", 1000);
    optionalText(subcommand, "title", "Panel title", 256);
    optionalText(subcommand, "description", "Panel description", 4000);
    optionalText(subcommand, "image", "Public image URL", 1000);
    optionalText(subcommand, "thumbnail", "Public thumbnail URL", 1000);
    return subcommand;
  });

const rulePanel = new SlashCommandBuilder()
  .setName("rulepanel")
  .setDescription("Create and edit an interactive rules panel.")
  .setDefaultMemberPermissions(adminPermissions)
  .addSubcommand((subcommand) => {
    subcommand.setName("create").setDescription("Create a rules acknowledgement panel.");
    panelOptions(subcommand);
    subcommand.addRoleOption((option) => option.setName("role").setDescription("Role given after acknowledgement").setRequired(false));
    optionalText(subcommand, "title", "Rules title", 256);
    optionalText(subcommand, "description", "Rules content", 4000);
    optionalText(subcommand, "button", "Acknowledgement button label", 80);
    optionalText(subcommand, "image", "Public image URL", 1000);
    optionalText(subcommand, "thumbnail", "Public thumbnail URL", 1000);
    return subcommand;
  })
  .addSubcommand((subcommand) => {
    subcommand.setName("edit").setDescription("Edit the saved rules panel.");
    panelOptions(subcommand, false, false);
    subcommand.addRoleOption((option) => option.setName("role").setDescription("Role given after acknowledgement").setRequired(false));
    optionalText(subcommand, "title", "Rules title", 256);
    optionalText(subcommand, "description", "Rules content", 4000);
    optionalText(subcommand, "button", "Acknowledgement button label", 80);
    optionalText(subcommand, "image", "Public image URL", 1000);
    optionalText(subcommand, "thumbnail", "Public thumbnail URL", 1000);
    return subcommand;
  });

function addEmbedOptions(subcommand, { targetChannel = false, name = false } = {}) {
  if (name) {
    subcommand.addStringOption((option) => option.setName("name").setDescription("Saved embed name").setMaxLength(64).setRequired(true));
  }
  if (targetChannel) {
    subcommand.addChannelOption((option) =>
      option.setName("channel").setDescription("Target text channel").addChannelTypes(ChannelType.GuildText).setRequired(false),
    );
  }
  optionalText(subcommand, "title", "Embed title", 256);
  optionalText(subcommand, "description", "Embed description", 4000);
  optionalText(subcommand, "color", "Hex color such as #38bdf8", 7);
  optionalText(subcommand, "footer", "Footer text", 2048);
  optionalText(subcommand, "image", "Public image URL", 1000);
  optionalText(subcommand, "thumbnail", "Public thumbnail URL", 1000);
  return subcommand;
}

const embedCommand = new SlashCommandBuilder()
  .setName("embed")
  .setDescription("Create, save, edit, send, and delete custom embeds.")
  .setDefaultMemberPermissions(adminPermissions)
  .addSubcommand((subcommand) => {
    subcommand.setName("send").setDescription("Send an embed to a channel.");
    return addEmbedOptions(subcommand, { targetChannel: true });
  })
  .addSubcommand((subcommand) => {
    subcommand.setName("save").setDescription("Save an embed template.");
    return addEmbedOptions(subcommand, { name: true });
  })
  .addSubcommand((subcommand) => {
    subcommand.setName("edit").setDescription("Edit a saved embed template.");
    return addEmbedOptions(subcommand, { name: true, targetChannel: true });
  })
  .addSubcommand((subcommand) => {
    subcommand.setName("delete").setDescription("Delete a saved embed template.");
    subcommand.addStringOption((option) => option.setName("name").setDescription("Saved embed name").setMaxLength(64).setRequired(true));
    return subcommand;
  })
  .addSubcommand((subcommand) => subcommand.setName("list").setDescription("List saved embed templates."));

export const slashDefinitions = [ticketCreate, colorPanel, rulePanel, embedCommand];

const isValidUrl = (value) => {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

function buttonStyle(value, fallback = "grey") {
  return ticketButtonStyles[String(value || fallback).toLowerCase()] || ticketButtonStyles[fallback];
}

function emojiValue(value) {
  if (!value) return undefined;
  const custom = /^<a?:([a-zA-Z0-9_]{2,32}):(\d+)>$/.exec(value.trim());
  if (custom) return { id: custom[2], name: custom[1], animated: value.startsWith("<a:") };
  return value.trim();
}

function applyEmoji(component, value) {
  const emoji = emojiValue(value);
  if (emoji) component.setEmoji(emoji);
  return component;
}

function defaultTicketReasons() {
  return [{ value: "support", label: "Support", description: "Open a support ticket", emoji: "" }];
}

function parseTicketReasons(value) {
  if (!value?.trim()) return defaultTicketReasons();
  const reasons = value
    .split(";")
    .map((entry, index) => {
      const [label, description, emoji = ""] = entry.split("|").map((part) => part.trim());
      if (!label) return null;
      return {
        value: `reason_${index + 1}`,
        label: label.slice(0, 100),
        description: (description || `Open a ${label} ticket`).slice(0, 100),
        emoji: emoji.slice(0, 100),
      };
    })
    .filter(Boolean)
    .slice(0, 25);
  return reasons.length ? reasons : defaultTicketReasons();
}

function ticketReasonsForPanel(panel) {
  return panel.reasons?.length ? panel.reasons : defaultTicketReasons();
}

const hexColor = (value, fallback = 0x18181b) => {
  if (!value) return fallback;
  return /^#[0-9a-f]{6}$/i.test(value) ? Number.parseInt(value.slice(1), 16) : fallback;
};

function embedFromPayload(payload) {
  const messageEmbed = new EmbedBuilder().setColor(hexColor(payload.color));
  if (payload.title) messageEmbed.setTitle(payload.title);
  if (payload.description) messageEmbed.setDescription(payload.description);
  if (payload.footer) messageEmbed.setFooter({ text: payload.footer });
  if (isValidUrl(payload.image)) messageEmbed.setImage(payload.image);
  if (isValidUrl(payload.thumbnail)) messageEmbed.setThumbnail(payload.thumbnail);
  if (payload.timestamp) messageEmbed.setTimestamp();
  return messageEmbed;
}

function getPanelValues(interaction, current = {}) {
  const option = interaction.options;
  const value = (name) => option.getString(name) ?? current[name];
  const channel = option.getChannel("channel");
  const role = option.getRole("role");
  return {
    ...current,
    channelId: channel?.id || current.channelId,
    categoryId: option.getChannel("category")?.id || current.categoryId,
    roleId: role?.id || current.roleId,
    title: value("title") || "Community panel",
    description: value("description") || "Choose an option below.",
    button: value("button") || current.button || "Open",
    buttonColor: option.getString("button_color") || current.buttonColor || "grey",
    buttonEmoji: value("button_emoji") || current.buttonEmoji || "",
    menuPlaceholder: value("menu_placeholder") || current.menuPlaceholder || "Choose a ticket reason",
    openingTitle: value("opening_title") || current.openingTitle || "Support ticket",
    openingDescription: value("opening_description") || current.openingDescription || "Please describe what you need help with.",
    openingImage: value("opening_image") || current.openingImage || "",
    openingThumbnail: value("opening_thumbnail") || current.openingThumbnail || "",
    color: value("color") || current.color || "#18181b",
    image: value("image") || current.image || "",
    thumbnail: value("thumbnail") || current.thumbnail || "",
    colors: value("colors") || current.colors || "",
  };
}

function panelMessage(panel, type) {
  const messageEmbed = embedFromPayload(panel);
  const rows = [];
  if (type === "ticket") {
    const openButton = new ButtonBuilder()
      .setCustomId("ticket:open")
      .setLabel(panel.button || "Open ticket")
      .setStyle(buttonStyle(panel.buttonColor));
    applyEmoji(openButton, panel.buttonEmoji);
    rows.push(new ActionRowBuilder().addComponents(openButton));
  } else if (type === "rules") {
    rows.push(new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("rules:accept").setLabel(panel.button || "I agree").setStyle(ButtonStyle.Success),
    ));
  } else if (type === "color") {
    const buttons = (panel.colorEntries || []).slice(0, 20).map((entry) =>
      new ButtonBuilder().setCustomId(`color:${entry.number}`).setLabel(`${entry.number} · ${entry.name}`).setStyle(ButtonStyle.Secondary),
    );
    for (let index = 0; index < buttons.length; index += 5) rows.push(new ActionRowBuilder().addComponents(buttons.slice(index, index + 5)));
  }
  return { embeds: [messageEmbed], components: rows };
}

function ticketReasonMenu(panel) {
  const menu = new StringSelectMenuBuilder()
    .setCustomId("ticket:reason")
    .setPlaceholder(panel.menuPlaceholder || "Choose a ticket reason")
    .addOptions(ticketReasonsForPanel(panel).map((reason) => ({
      label: reason.label,
      value: reason.value,
      description: reason.description,
      ...(emojiValue(reason.emoji) ? { emoji: emojiValue(reason.emoji) } : {}),
    })));
  return new ActionRowBuilder().addComponents(menu);
}

function parseColorEntries(value) {
  return value
    .split(/\s+/)
    .map((definition) => /^([^:]{1,30}):#?([0-9a-f]{6})$/i.exec(definition))
    .filter(Boolean)
    .slice(0, 20)
    .map((match, index) => ({ number: index + 1, name: match[1], hex: `#${match[2].toLowerCase()}` }));
}

async function requireAdmin(interaction) {
  if (isBotOwner(interaction.user.id) || isServerAdmin(interaction.member)) return true;
  await interaction.reply({ embeds: [error("Permission denied", "Only bot owners and server administrators can configure panels.")], ephemeral: true });
  return false;
}

async function sendOrEditPanel(interaction, db, panel, type, fieldName, current = null) {
  const guild = interaction.guild;
  const channel = guild.channels.cache.get(panel.channelId);
  if (!channel?.isTextBased()) throw new Error("The selected panel channel is unavailable.");
  let message;
  if (current?.messageId && current.channelId === panel.channelId) {
    message = await channel.messages.fetch(current.messageId).catch(() => null);
  }
  if (message) await message.edit(panelMessage(panel, type));
  else message = await channel.send(panelMessage(panel, type));
  panel.messageId = message.id;
  await db.updateGuild(guild.id, { [fieldName]: panel });
  return message;
}

async function handleTicketPanel(interaction, db) {
  if (!(await requireAdmin(interaction))) return;
  const current = (await db.getGuild(interaction.guild.id)).ticket_panel || {};
  const panel = getPanelValues(interaction, current);
  const reasons = interaction.options.getString("reasons");
  panel.reasons = reasons ? parseTicketReasons(reasons) : ticketReasonsForPanel(current);
  const category = interaction.options.getChannel("category");
  if (category) panel.categoryId = category.id;
  await sendOrEditPanel(interaction, db, panel, "ticket", "ticket_panel", interaction.options.getSubcommand() === "edit" ? current : null);
  await interaction.reply({ embeds: [success("Ticket panel saved", `The interactive panel is ready in <#${panel.channelId}>. Use \`/ticketpanel edit\` to update its message and opening text.`)], ephemeral: true });
}

async function handleColorPanel(interaction, db) {
  if (!(await requireAdmin(interaction))) return;
  const settings = await db.getGuild(interaction.guild.id);
  const current = settings.color_panel || {};
  const panel = getPanelValues(interaction, current);
  const colorText = interaction.options.getString("colors");
  panel.colorEntries = colorText ? parseColorEntries(colorText) : current.colorEntries || [];
  if (!panel.colorEntries.length) {
    await interaction.reply({ embeds: [error("Colors required", "Use entries such as `pink:#ff8fab blue:#8ecae6`.")], ephemeral: true });
    return;
  }
  for (const entry of panel.colorEntries) {
    const existing = (await db.getColorRoles(interaction.guild.id)).find((role) => role.number === entry.number);
    const role = existing ? interaction.guild.roles.cache.get(existing.role_id) : await interaction.guild.roles.create({ name: `color-${entry.name}`, color: entry.hex.slice(1), reason: "Slash color panel" });
    if (role) await db.saveColorRole(interaction.guild.id, entry.number, role.id, entry.name, entry.hex);
    entry.roleId = role?.id;
  }
  await sendOrEditPanel(interaction, db, panel, "color", "color_panel", interaction.options.getSubcommand() === "edit" ? current : null);
  await db.updateGuild(interaction.guild.id, { color_channel_id: panel.channelId });
  await interaction.reply({ embeds: [success("Color panel saved", `The interactive color panel is ready in <#${panel.channelId}>.`)], ephemeral: true });
}

async function handleRulePanel(interaction, db) {
  if (!(await requireAdmin(interaction))) return;
  const current = (await db.getGuild(interaction.guild.id)).rules_panel || {};
  const panel = getPanelValues(interaction, current);
  if (!interaction.options.getString("button") && !current.button) panel.button = "I agree";
  await sendOrEditPanel(interaction, db, panel, "rules", "rules_panel", interaction.options.getSubcommand() === "edit" ? current : null);
  await interaction.reply({ embeds: [success("Rules panel saved", `The interactive rules panel is ready in <#${panel.channelId}>.`)], ephemeral: true });
}

function payloadFromOptions(interaction, current = {}) {
  const option = interaction.options;
  const get = (name) => option.getString(name) ?? current[name] ?? "";
  return {
    title: get("title"),
    description: get("description"),
    color: get("color") || "#18181b",
    footer: get("footer"),
    image: get("image"),
    thumbnail: get("thumbnail"),
    timestamp: current.timestamp || false,
  };
}

async function handleEmbed(interaction, db) {
  if (!(await requireAdmin(interaction))) return;
  const action = interaction.options.getSubcommand();
  if (action === "list") {
    const templates = await db.listCustomEmbeds(interaction.guild.id);
    await interaction.reply({ embeds: [info("Saved embeds", templates.length ? templates.map((template) => `\`${template.name}\``).join("\n") : "No saved embeds.")], ephemeral: true });
    return;
  }
  const name = interaction.options.getString("name");
  if (action === "delete") {
    await db.removeCustomEmbed(interaction.guild.id, name);
    await interaction.reply({ embeds: [success("Embed deleted", `\`${name}\` was removed.`)], ephemeral: true });
    return;
  }
  const existing = name ? await db.getCustomEmbed(interaction.guild.id, name) : null;
  if (action === "edit" && !existing) {
    await interaction.reply({ embeds: [error("Embed not found", `No saved embed named \`${name}\` exists.`)], ephemeral: true });
    return;
  }
  const payload = payloadFromOptions(interaction, existing?.payload || {});
  if (action === "save" || action === "edit") {
    await db.saveCustomEmbed(interaction.guild.id, name, payload, interaction.user.id);
  }
  if (action === "send" || action === "edit") {
    const channel = interaction.options.getChannel("channel") || interaction.channel;
    if (!channel?.isTextBased()) {
      await interaction.reply({ embeds: [error("Channel unavailable", "Choose a text channel.")], ephemeral: true });
      return;
    }
    await channel.send({ embeds: [embedFromPayload(payload)] });
  }
  await interaction.reply({ embeds: [success("Embed updated", action === "save" ? `Saved \`${name}\`.` : "The embed was processed.")], ephemeral: true });
}

export async function registerSlashCommands(client) {
  const data = slashDefinitions.map((command) => command.toJSON());
  for (const guild of client.guilds.cache.values()) {
    await guild.commands.set(data).catch((err) => console.error(`[slash-register:${guild.id}]`, err));
  }
}

async function createTicketFromReason(interaction, settings, panel, reason) {
  const existing = interaction.guild.channels.cache.find((channel) => channel.topic === `ticket-owner:${interaction.user.id}`);
  if (existing) {
    await interaction.reply({ content: `You already have a ticket: ${existing}`, ephemeral: true });
    return;
  }
  const reasonSlug = reason.label.toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/gi, "-").replace(/^-|-$/g, "").slice(0, 24) || "ticket";
  const channel = await interaction.guild.channels.create({
    name: `${reasonSlug}-${interaction.user.username}`.slice(0, 90),
    type: ChannelType.GuildText,
    parent: panel.categoryId || settings.ticket_category_id || undefined,
    topic: `ticket-owner:${interaction.user.id}`,
    permissionOverwrites: [
      { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
      { id: interaction.guild.members.me.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] },
    ],
  });
  await channel.send({
    embeds: [embedFromPayload({
      title: panel.openingTitle || "Support ticket",
      description: `${panel.openingDescription || "Please describe what you need help with."}\n\n**Reason:** ${reason.label}`,
      color: panel.color,
      image: panel.openingImage,
      thumbnail: panel.openingThumbnail,
    })],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("ticket:close").setLabel("Close ticket").setStyle(ButtonStyle.Danger),
    )],
  });
  await interaction.reply({ content: `Ticket created: ${channel}`, ephemeral: true });
}

export async function handlePanelButton(interaction, db) {
  if (interaction.isStringSelectMenu() && interaction.customId === "ticket:reason") {
    const settings = await db.getGuild(interaction.guild.id);
    const panel = settings.ticket_panel || {};
    const reason = ticketReasonsForPanel(panel).find((entry) => entry.value === interaction.values[0]) || ticketReasonsForPanel(panel)[0];
    await createTicketFromReason(interaction, settings, panel, reason);
    return;
  }
  if (interaction.customId === "ticket:open" || interaction.customId === "ticket:create") {
    const settings = await db.getGuild(interaction.guild.id);
    const panel = settings.ticket_panel || {};
    const existing = interaction.guild.channels.cache.find((channel) => channel.topic === `ticket-owner:${interaction.user.id}`);
    if (existing) return interaction.reply({ content: `You already have a ticket: ${existing}`, ephemeral: true });
    await interaction.reply({ content: "Choose a reason for opening your ticket:", components: [ticketReasonMenu(panel)], ephemeral: true });
    return;
  }
  if (interaction.customId === "ticket:close") {
    const ownerId = interaction.channel.topic?.replace("ticket-owner:", "");
    if (interaction.user.id !== ownerId && !isServerAdmin(interaction.member)) {
      return interaction.reply({ embeds: [error("Permission denied", "Only the ticket owner or a server administrator can close this ticket.")], ephemeral: true });
    }
    await interaction.reply({ embeds: [success("Ticket closing", "This ticket will be deleted in 5 seconds.")] });
    setTimeout(() => interaction.channel.delete("Ticket closed").catch(() => {}), 5_000);
    return;
  }
  if (interaction.customId.startsWith("color:")) {
    const number = Number(interaction.customId.split(":")[1]);
    const roles = await db.getColorRoles(interaction.guild.id);
    const selected = roles.find((role) => role.number === number);
    if (!selected) return interaction.reply({ embeds: [error("Color unavailable", "That color role no longer exists.")], ephemeral: true });
    const ids = new Set(roles.map((role) => role.role_id));
    await interaction.member.roles.remove(interaction.member.roles.cache.filter((role) => ids.has(role.id))).catch(() => {});
    await interaction.member.roles.add(selected.role_id).catch(() => {});
    await interaction.reply({ embeds: [success("Color updated", `You now have **${selected.role_name}**.`)], ephemeral: true });
    return;
  }
  if (interaction.customId === "rules:accept") {
    const panel = (await db.getGuild(interaction.guild.id)).rules_panel || {};
    if (panel.roleId) await interaction.member.roles.add(panel.roleId).catch(() => {});
    await interaction.reply({ embeds: [success("Rules acknowledged", "Your acknowledgement has been recorded.")], ephemeral: true });
  }
}

export async function handleSlashInteraction(interaction, db) {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName === "ticketpanel") return handleTicketPanel(interaction, db);
  if (interaction.commandName === "colorpanel") return handleColorPanel(interaction, db);
  if (interaction.commandName === "rulepanel") return handleRulePanel(interaction, db);
  if (interaction.commandName === "embed") return handleEmbed(interaction, db);
}