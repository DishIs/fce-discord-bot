import WebSocket from "ws";
import { Client, TextChannel } from "discord.js";
import { getAllActiveWatches, removeWatch } from "../lib/store.js";
import { watchAlertEmbed } from "../lib/embed.js";
import { t } from "../i18n/index.js";

const WS_BASE = process.env.FCE_WS_BASE ?? "wss://api2.freecustom.email/v1";
const RECONNECT_DELAY = 5_000;

interface WatchEntry {
  discordId: string;
  inbox:     string;
  channelId: string;
  apiKey:    string;
  locale:    string;
}

// One WebSocket per (apiKey, inbox) pair
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

  const url = `${WS_BASE}/inboxes/${encodeURIComponent(entry.inbox)}/stream`;

  function connect(retries = 0) {
    const ws = new WebSocket(url, {
      headers: { Authorization: `Bearer ${entry.apiKey}` },
    });

    const conn: WsConn = { ws, active: true, retries };
    connections.set(key, conn);

    ws.on("message", async (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        await deliverEmail(entry, msg);
      } catch (err) {
        console.error("[ws] parse error", err);
      }
    });

    ws.on("close", () => {
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
  try {
    const channel = await discordClient.channels.fetch(entry.channelId);
    if (!channel?.isTextBased()) throw new Error("not text channel");

    const embed = watchAlertEmbed({
      inbox:             entry.inbox,
      from:              String(msg.from ?? ""),
      subject:           String(msg.subject ?? "(no subject)"),
      otp:               msg.otp ? String(msg.otp) : undefined,
      verification_link: msg.verification_link ? String(msg.verification_link) : undefined,
      timestamp:         msg.timestamp ? Number(msg.timestamp) : undefined,
    });

    await (channel as TextChannel).send({ embeds: [embed] });
  } catch (err: unknown) {
    console.error("[ws] deliver failed", err);

    // Try DM fallback
    try {
      const user    = await discordClient.users.fetch(entry.discordId);
      const embed   = watchAlertEmbed({
        inbox:   entry.inbox,
        from:    String(msg.from ?? ""),
        subject: String(msg.subject ?? "(no subject)"),
      });
      const warning = t(entry.locale, "watch.email_fallback", {
        channel: `<#${entry.channelId}>`,
      });
      await user.send({ content: warning, embeds: [embed] });
    } catch {
      // DMs also blocked — give up
    }
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

// Called on bot startup — reconnects all active DB watches
export async function initWatchManager(client: Client): Promise<void> {
  discordClient = client;

  const watches = await getAllActiveWatches();
  for (const w of watches) {
    if (!w.user?.apiKey) continue;
    await openConnection({
      discordId: w.discordId,
      inbox:     w.inbox,
      channelId: w.channelId,
      apiKey:    w.user.apiKey,
      locale:    w.user.locale ?? "en-US",
    });
  }

  console.log(`[ws] Reconnected ${watches.length} watch(es)`);
}

// Called by /watch add command
export async function startWatch(
  discordId: string,
  inbox:     string,
  channelId: string,
  apiKey:    string,
  locale:    string
): Promise<void> {
  await openConnection({ discordId, inbox, channelId, apiKey, locale });
}

// Called by /watch remove command
export async function stopWatch(
  discordId: string,
  inbox:     string,
  apiKey:    string
): Promise<void> {
  closeConnection(apiKey, inbox);
  await removeWatch(discordId, inbox);
}
