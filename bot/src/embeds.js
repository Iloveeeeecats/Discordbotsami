import { EmbedBuilder } from "discord.js";
import { ornament, truncate } from "./utils.js";

const COLORS = {
  base: 0x18181b,
  success: 0x84cc16,
  error: 0xf43f5e,
  info: 0x38bdf8,
  warning: 0xf59e0b,
};

export function embed(title, description, color = COLORS.base) {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(`${ornament()} ${truncate(title, 250)}`)
    .setDescription(truncate(description || "Done.", 4096))
    .setTimestamp();
}

export const success = (title, description) => embed(title, description, COLORS.success);
export const error = (title, description) => embed(title, description, COLORS.error);
export const info = (title, description) => embed(title, description, COLORS.info);
export const warning = (title, description) => embed(title, description, COLORS.warning);

export function failureMessage(errorValue) {
  const code = errorValue?.code;
  if (code === 50013) return "I do not have permission to do that.";
  if (code === 50001) return "I cannot access that channel or member.";
  if (code === 10007 || code === 10013) return "That Discord object no longer exists.";
  return "Discord rejected that action. Check my permissions and try again.";
}