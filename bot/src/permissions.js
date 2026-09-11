import { PermissionFlagsBits } from "discord.js";
import { config } from "./config.js";

export const isBotOwner = (userId) => config.ownerIds.has(userId);
export const isServerAdmin = (member) => member?.permissions.has(PermissionFlagsBits.Administrator) ?? false;

export async function hasStaffPermission(message, db, commandName) {
  if (isBotOwner(message.author.id) || isServerAdmin(message.member)) return true;
  return db.roleHasPermission(message.guild.id, message.member, commandName);
}

export async function canUse(message, command, db) {
  if (command.ownerOnly) return isBotOwner(message.author.id);
  if (command.adminOnly) return isBotOwner(message.author.id) || isServerAdmin(message.member);
  if (command.permission && !message.member.permissions.has(command.permission)) return false;
  if (command.staff) return hasStaffPermission(message, db, command.name);
  return true;
}

export function hierarchyError(actor, target, botMember, action) {
  if (!target) return `I could not find that member to ${action}.`;
  if (target.id === actor.id) return `You cannot ${action} yourself.`;
  if (target.id === botMember?.id) return `I cannot ${action} myself.`;
  if (target.id === actor.guild.ownerId) return `The server owner cannot be targeted.`;
  if (actor.id !== actor.guild.ownerId && target.roles.highest.position >= actor.roles.highest.position) {
    return `Your highest role must be above the target's highest role to ${action}.`;
  }
  if (botMember && target.roles.highest.position >= botMember.roles.highest.position) {
    return `My highest role must be above the target's highest role to ${action}.`;
  }
  return null;
}

export const commandPermissionNames = ["lock", "unlock", "role", "blacklist", "jail", "unjail", "clear", "ticket", "mute", "unmute", "timeout", "untimeout"];