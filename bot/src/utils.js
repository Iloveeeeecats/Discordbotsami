export const symbols = ["♡", "☆", "✦", "✧", "୨୧", "౨ৎ", "𐙚", "ꔫ", "⪩", "𓂃", "◌", "❊", "⊰", "ꕤ", "✿", "₊", "｡", "˚"];

export const ornament = () => symbols[Math.floor(Math.random() * symbols.length)];

export const cleanReason = (reason) => (reason || "No reason provided").trim().slice(0, 500);

export function parseDuration(input) {
  const match = /^(\d{1,6})(s|m|h|d|w)$/i.exec(input || "");
  if (!match) return null;
  const units = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000, w: 604_800_000 };
  const ms = Number(match[1]) * units[match[2].toLowerCase()];
  return ms > 0 && ms <= 28 * 86_400_000 ? ms : null;
}

export const levelFromXp = (points) => Math.floor(Math.sqrt(Math.max(0, points) / 100));

export const xpForLevel = (level) => level * level * 100;

export const truncate = (value, max = 1024) =>
  value.length > max ? `${value.slice(0, Math.max(0, max - 1))}…` : value;

export const parseMentionOrId = (value) => value?.match(/^<@!?(\d+)>$/)?.[1] || value;

export function tokenize(input) {
  const tokens = [];
  const pattern = /"([^"]+)"|'([^']+)'|(\S+)/g;
  let match;
  while ((match = pattern.exec(input)) !== null) tokens.push(match[1] || match[2] || match[3]);
  return tokens;
}

export function renderTemplate(template, member) {
  return template
    .replaceAll("{user}", `<@${member.id}>`)
    .replaceAll("{username}", member.user.username)
    .replaceAll("{server}", member.guild.name)
    .replaceAll("{membercount}", String(member.guild.memberCount))
    .replaceAll("{channel}", `<#${member.guild.systemChannelId || member.guild.rulesChannelId || ""}>`);
}

export function wholeWordMatch(content, words) {
  return words.some((word) => new RegExp(`(^|[^\\p{L}\\p{N}])${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=$|[^\\p{L}\\p{N}])`, "iu").test(content));
}