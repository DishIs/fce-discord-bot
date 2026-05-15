import { MessageFlags } from "discord.js";
import { prisma, redis } from "./store.js";

// ── Output mode ───────────────────────────────────────────────────────────────
// In DMs  : per-user setting (publicOutput on User)
// In guilds: per-guild setting (publicOutput on Guild), admin-controlled

async function lookupPublic(discordId: string, guildId: string | null): Promise<boolean> {
  const cacheKey = guildId ? `out_mode:guild:${guildId}` : `out_mode:user:${discordId}`;
  const cached   = await redis.get(cacheKey).catch(() => null);
  if (cached !== null) return cached === "1";

  let isPublic: boolean;
  if (guildId) {
    const g = await prisma.guild.findUnique({ where: { guildId }, select: { publicOutput: true } });
    isPublic = g?.publicOutput ?? false;
  } else {
    const u = await prisma.user.findUnique({ where: { discordId }, select: { publicOutput: true } });
    isPublic = u?.publicOutput ?? false;
  }

  redis.setex(cacheKey, 60, isPublic ? "1" : "0").catch(() => {});
  return isPublic;
}

export async function isOutputEphemeral(discordId: string, guildId: string | null): Promise<boolean> {
  return !(await lookupPublic(discordId, guildId));
}

export async function setUserOutputMode(discordId: string, isPublic: boolean): Promise<void> {
  await prisma.user.update({ where: { discordId }, data: { publicOutput: isPublic } });
  redis.setex(`out_mode:user:${discordId}`, 60, isPublic ? "1" : "0").catch(() => {});
}

export async function setGuildOutputMode(guildId: string, isPublic: boolean): Promise<void> {
  await prisma.guild.update({ where: { guildId }, data: { publicOutput: isPublic } });
  redis.setex(`out_mode:guild:${guildId}`, 60, isPublic ? "1" : "0").catch(() => {});
}

// ── Last-message tracking (for /pin) ─────────────────────────────────────────

export function trackBotMessage(channelId: string, messageId: string): void {
  redis.setex(`bot:pin:${channelId}`, 86400, messageId).catch(() => {});
}

export async function getLastBotMessage(channelId: string): Promise<string | null> {
  return redis.get(`bot:pin:${channelId}`).catch(() => null);
}
