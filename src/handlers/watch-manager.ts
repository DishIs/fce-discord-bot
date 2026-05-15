import WebSocket from "ws";
import { Client, TextChannel } from "discord.js";
import { getAllActiveWatches, removeWatch } from "../lib/store.js";
import { watchAlertEmbed } from "../lib/embed.js";
import { isOutputEphemeral, createViewToken } from "../lib/reply-mode.js";
import { t } from "../i18n/index.js";

const WS_BASE         = process.env.FCE_WS_BASE     ?? "wss://api2.freecustom.email/v1/ws";
const CALLBACK_BASE   = process.env.CALLBACK_BASE_URL ?? "http://localhost:4242";
const RECONNECT_DELAY = 5_000;
const PING_INTERVAL   = 25_000;

interface WatchEntry {
  discordId: string;
  inbox:     string;
  channelId: string;
  guildId:   string | null;
  apiKey:    string;
  locale:    string;
}

interface WsConn {
  ws:      WebSocket;
  active:  boolean;
  retries: number;
}

const connections = new Map<string, WsConn>();
let discordClient: Client;

function connKey(apiKey: string, inbox: string) {
  return `${apiKey}::${inbox}`;
}

async function openConnection(entry: WatchEntry): Promise<void> {
  const key = connKey(entry.apiKey, entry.inbox);
  if (connections.has(key)) return;

  const url = `${WS_BASE}?api_key=${encodeURIComponent(entry.apiKey)}&mailbox=${encodeURIComponent(entry.inbox)}`;

  function connect(retries = 0) {
    const ws = new WebSocket(url);
    const conn: WsConn = { ws, active: true, retries };
    connections.set(key, conn);

    const pingTimer = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "ping" }));
    }, PING_INTERVAL);

    ws.on("message", async (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as Record<string, unknown>;
        if (msg.type === "connected" || msg.type === "pong") return;
        if (msg.type === "error") {
          console.error("[ws] server error", msg.code, msg.message);
          return;
        }
        await deliverEmail(entry, msg);
      } catch (err) {
        console.error("[ws] parse error", err);
      }
    });

    ws.on("close", () => {
      clearInterval(pingTimer);
      if (!conn.active) return;
      const delay = Math.min(RECONNECT_DELAY * 2 ** retries, 60_000);
      setTimeout(() => connect(retries + 1), delay);
    });

    ws.on("error", (err) => {
      console.error("[ws]", entry.inbox, err.message);
    });
  }

  connect();
}

async function deliverEmail(entry: WatchEntry, msg: Record<string, unknown>) {
  const otp = (() => {
    const v = msg.otp ? String(msg.otp) : undefined;
    if (!v || v === "null" || v === "__DETECTED__" || v === "__UPGRADE_REQUIRED__") return undefined;
    return v;
  })();

  // Generate a view token so the alert has an "Open email" button
  const messageId = msg.id ? String(msg.id) : undefined;
  let viewUrl: string | undefined;
  if (messageId) {
    try {
      const token = await createViewToken({ inbox: entry.inbox, messageId, apiKey: entry.apiKey });
      viewUrl = `${CALLBACK_BASE}/view/${token}`;
    } catch { /* non-fatal */ }
  }

  const alertData = {
    inbox:             entry.inbox,
    from:              String(msg.from ?? ""),
    subject:           String(msg.subject ?? "(no subject)"),
    otp,
    verification_link: msg.verificationLink ? String(msg.verificationLink) : undefined,
    timestamp:         msg.date ? new Date(String(msg.date)).getTime() : undefined,
    viewUrl,
  };

  // Check output mode: if the guild is in private mode, DM the user instead of channel post
  const isPrivate = await isOutputEphemeral(entry.discordId, entry.guildId).catch(() => false);

  if (isPrivate) {
    try {
      const dmUser = await discordClient.users.fetch(entry.discordId);
      const { embed, row } = watchAlertEmbed(alertData);
      const note = entry.guildId
        ? `> *Private mode is on for this server — alerts go to your DM.*`
        : "";
      await dmUser.send({ content: note || undefined, embeds: [embed], components: row ? [row] : [] });
    } catch (err) {
      console.error("[ws] DM delivery failed", err);
    }
    return;
  }

  // Public mode — post to the configured channel
  try {
    const channel = await discordClient.channels.fetch(entry.channelId);
    if (!channel?.isTextBased()) throw new Error("not text channel");
    const { embed, row } = watchAlertEmbed(alertData);
    await (channel as TextChannel).send({ embeds: [embed], components: row ? [row] : [] });
  } catch (err) {
    console.error("[ws] channel delivery failed", err);
    // Fallback: try DM
    try {
      const dmUser = await discordClient.users.fetch(entry.discordId);
      const { embed, row } = watchAlertEmbed(alertData);
      const warning = t(entry.locale, "watch.email_fallback", { channel: `<#${entry.channelId}>` });
      await dmUser.send({ content: warning, embeds: [embed], components: row ? [row] : [] });
    } catch { /* DMs blocked — give up */ }
  }
}

export function closeConnection(apiKey: string, inbox: string): void {
  const key  = connKey(apiKey, inbox);
  const conn = connections.get(key);
  if (!conn) return;
  conn.active = false;
  conn.ws.close();
  connections.delete(key);
}

export async function initWatchManager(client: Client): Promise<void> {
  discordClient = client;

  const watches = await getAllActiveWatches();
  for (const w of watches) {
    if (!w.user?.apiKey) continue;
    await openConnection({
      discordId: w.discordId,
      inbox:     w.inbox,
      channelId: w.channelId,
      guildId:   w.guildId ?? null,
      apiKey:    w.user.apiKey,
      locale:    w.user.locale ?? "en-US",
    });
  }

  console.log(`[ws] Reconnected ${watches.length} watch(es)`);
}

export async function startWatch(
  discordId: string,
  inbox:     string,
  channelId: string,
  guildId:   string | null,
  apiKey:    string,
  locale:    string
): Promise<void> {
  await openConnection({ discordId, inbox, channelId, guildId, apiKey, locale });
}

export async function stopWatch(
  discordId: string,
  inbox:     string,
  apiKey:    string
): Promise<void> {
  closeConnection(apiKey, inbox);
  await removeWatch(discordId, inbox);
}
