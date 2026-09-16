import { ActivityType } from "discord.js";

export const activityTypes = {
  playing: ActivityType.Playing,
  streaming: ActivityType.Streaming,
  listening: ActivityType.Listening,
  watching: ActivityType.Watching,
  competing: ActivityType.Competing,
};

export const presenceStatuses = new Set(["online", "idle", "dnd", "invisible"]);

export function normalizePresence({ type, text, status = "online", url = null }) {
  const activityType = String(type || "playing").toLowerCase();
  const presenceStatus = String(status || "online").toLowerCase();
  const activityText = String(text || "").trim().slice(0, 128);
  const activityUrl = url ? String(url).trim().slice(0, 500) : null;
  if (!activityTypes[activityType]) throw new Error("Activity type must be playing, streaming, listening, watching, or competing.");
  if (!presenceStatuses.has(presenceStatus)) throw new Error("Presence status must be online, idle, dnd, or invisible.");
  if (!activityText) throw new Error("Status text is required.");
  if (activityType === "streaming" && !/^https?:\/\/\S+$/i.test(activityUrl || "")) {
    throw new Error("Streaming status requires a valid stream URL.");
  }
  if (activityUrl && !/^https?:\/\/\S+$/i.test(activityUrl)) throw new Error("The stream URL must start with http:// or https://.");
  return {
    presence_status: presenceStatus,
    activity_type: activityType,
    activity_text: activityText,
    activity_url: activityType === "streaming" ? activityUrl : null,
  };
}

export function presencePayload(profile) {
  const activity = profile?.activity_text
    ? {
        name: profile.activity_text,
        type: activityTypes[profile.activity_type] ?? ActivityType.Playing,
        ...(profile.activity_type === "streaming" && profile.activity_url ? { url: profile.activity_url } : {}),
      }
    : null;
  return {
    status: presenceStatuses.has(profile?.presence_status) ? profile.presence_status : "online",
    activities: activity ? [activity] : [],
  };
}

export async function applyStoredPresence(client, db) {
  const profile = await db.getBotProfile();
  client.user.setPresence(presencePayload(profile));
  return profile;
}