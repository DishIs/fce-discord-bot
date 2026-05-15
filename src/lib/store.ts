import { PrismaClient } from "@prisma/client";
import { Redis } from "ioredis";
import { randomUUID } from "crypto";

export const prisma = new PrismaClient();

export const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  lazyConnect:      true,
  enableReadyCheck: false,
  maxRetriesPerRequest: 3,
});

redis.on("error", (e) => console.error("[redis]", e.message));

const LOGIN_TTL = parseInt(process.env.LOGIN_STATE_TTL ?? "180", 10);

// ── Login state ────────────────────────────────────────────────────────────────

export interface LoginResult {
  discordId:        string;
  channelId:        string | null;
  interactionToken: string | null;
}

export async function createLoginState(
  discordId:        string,
  channelId:        string,
  interactionToken: string
): Promise<string> {
  const state     = randomUUID();
  const expiresAt = new Date(Date.now() + LOGIN_TTL * 1000);

  await Promise.all([
    redis.setex(`login:${state}`, LOGIN_TTL, JSON.stringify({ discordId, channelId, interactionToken })),
    prisma.loginState.create({ data: { state, discordId, channelId, expiresAt } }),
  ]);

  return state;
}

export async function consumeLoginState(
  state: string,
  apiKey: string,
  username: string
): Promise<LoginResult | null> {
  const raw = await redis.get(`login:${state}`);
  if (!raw) {
    // Redis evicted — fall back to Postgres (no interaction token available)
    const row = await prisma.loginState.findUnique({ where: { state } });
    if (!row || row.used || row.expiresAt < new Date()) return null;
    await prisma.loginState.update({ where: { state }, data: { used: true } });
    await upsertUser(row.discordId, username, apiKey);
    return { discordId: row.discordId, channelId: row.channelId ?? null, interactionToken: null };
  }

  const { discordId, channelId, interactionToken } = JSON.parse(raw) as {
    discordId: string; channelId: string; interactionToken: string;
  };
  await redis.del(`login:${state}`);
  await prisma.loginState.updateMany({ where: { state }, data: { used: true } });
  await upsertUser(discordId, username, apiKey);
  return { discordId, channelId: channelId ?? null, interactionToken: interactionToken ?? null };
}

// ── User ──────────────────────────────────────────────────────────────────────

export async function upsertUser(
  discordId: string,
  username:  string,
  apiKey:    string
): Promise<void> {
  await prisma.user.upsert({
    where:  { discordId },
    create: { discordId, username, apiKey },
    update: { username, apiKey },
  });
}

export async function getUser(discordId: string) {
  return prisma.user.findUnique({ where: { discordId } });
}

export async function getUserApiKey(discordId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where:  { discordId },
    select: { apiKey: true },
  });
  return user?.apiKey ?? null;
}

export async function deleteUser(discordId: string): Promise<void> {
  await prisma.user.delete({ where: { discordId } }).catch(() => {});
}

export async function updateUserPlan(
  discordId: string,
  plan:      string,
  planLabel: string
): Promise<void> {
  await prisma.user.update({
    where: { discordId },
    data:  { plan, planLabel },
  });
}

export async function incrementCommandCount(discordId: string): Promise<number> {
  const user = await prisma.user.update({
    where: { discordId },
    data:  { commandCount: { increment: 1 } },
    select: { commandCount: true },
  });
  return user.commandCount;
}

export async function setJsonMode(discordId: string, on: boolean): Promise<void> {
  await prisma.user.update({ where: { discordId }, data: { jsonMode: on } });
}

export async function markFeedbackSent(discordId: string): Promise<void> {
  await prisma.user.update({ where: { discordId }, data: { feedbackSent: true } });
}

export async function updateLocale(discordId: string, locale: string): Promise<void> {
  await prisma.user.update({ where: { discordId }, data: { locale } });
}

// ── Watch ─────────────────────────────────────────────────────────────────────

export async function addWatch(
  discordId: string,
  inbox:     string,
  channelId: string,
  guildId?:  string
): Promise<void> {
  await prisma.watch.upsert({
    where:  { discordId_inbox: { discordId, inbox } },
    create: { discordId, inbox, channelId, guildId, active: true },
    update: { channelId, guildId, active: true },
  });
}

export async function removeWatch(discordId: string, inbox: string): Promise<boolean> {
  const result = await prisma.watch.updateMany({
    where: { discordId, inbox },
    data:  { active: false },
  });
  return result.count > 0;
}

export async function getUserWatches(discordId: string) {
  return prisma.watch.findMany({
    where:   { discordId, active: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function getAllActiveWatches() {
  return prisma.watch.findMany({
    where:   { active: true },
    include: { user: { select: { apiKey: true, locale: true } } },
  });
}

export async function countActiveWatches(discordId: string): Promise<number> {
  return prisma.watch.count({ where: { discordId, active: true } });
}

// ── Feedback ──────────────────────────────────────────────────────────────────

export async function saveFeedback(
  discordId:    string,
  username:     string,
  stars:        number,
  comment:      string | null,
  commandCount: number
): Promise<void> {
  await prisma.feedback.create({
    data: { discordId, username, stars, comment, commandCount },
  });
  await markFeedbackSent(discordId);
}

export async function getAllFeedback() {
  return prisma.feedback.findMany({
    orderBy: { createdAt: "desc" },
    take:    500,
  });
}
