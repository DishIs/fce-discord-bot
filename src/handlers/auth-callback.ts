import express from "express";
import { Client, MessageFlags, WebhookClient } from "discord.js";
import { consumeLoginState, syncUserPlan } from "../lib/store.js";
import { FceApi } from "../lib/api.js";
import { t } from "../i18n/index.js";

const PORT = parseInt(process.env.CALLBACK_PORT ?? "4242", 10);

export function startAuthServer(client: Client): void {
  const app = express();

  // GET /auth/callback?api_key=<key>&state=<uuid>&username=<name>
  app.get("/auth/callback", async (req, res) => {
    const { api_key, state, username } = req.query as Record<string, string>;

    if (!api_key || !state) {
      res.status(400).send("Bad request");
      return;
    }

    try {
      const result = await consumeLoginState(state, api_key, username ?? "");

      if (!result) {
        res.status(410).send("Login link expired or already used.");
        return;
      }

      const { discordId, interactionToken } = result;

      // Sync plan from API immediately after login
      await syncUserPlan(discordId, api_key).catch(() => {});

      // Fetch locale
      const { prisma } = await import("../lib/store.js");
      const user  = await prisma.user.findUnique({
        where:  { discordId },
        select: { locale: true },
      });
      const locale = user?.locale ?? "en-US";

      const successMsg = `${t(locale, "login.success")}\n${t(locale, "login.success_hint")}`;

      // Edit the original ephemeral /login reply — stays private, replaces the login button
      if (interactionToken && client.application?.id) {
        try {
          const webhook = new WebhookClient({
            id:    client.application.id,
            token: interactionToken,
          });
          await webhook.editMessage("@original", {
            content:    successMsg,
            embeds:     [],
            components: [],
          });
        } catch {
          // Token expired (>15 min) — fall back to DM
          try {
            const dmUser = await client.users.fetch(discordId);
            await dmUser.send(successMsg);
          } catch { /* DMs disabled */ }
        }
      } else {
        // Postgres fallback path — no token, try DM
        try {
          const dmUser = await client.users.fetch(discordId);
          await dmUser.send(successMsg);
        } catch { /* DMs disabled */ }
      }

      res.status(200).send(`
        <!DOCTYPE html>
        <html>
          <head><title>Login successful</title>
          <meta charset="utf-8">
          <style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#0d0d0d;color:#e5e5e5;}
          .box{text-align:center;padding:2rem;}h1{color:#22c55e;margin-bottom:.5rem;}</style></head>
          <body><div class="box">
            <h1>✓ Logged in!</h1>
            <p>You can close this tab and return to Discord.</p>
          </div></body>
        </html>
      `);
    } catch (err) {
      console.error("[auth-callback]", err);
      res.status(500).send("Internal error. Run /login again.");
    }
  });

  // Health check for nginx/docker
  app.get("/health", (_req, res) => res.json({ ok: true }));

  // GET /admin/feedback — returns bot feedback rows (protected by shared admin password)
  app.get("/admin/feedback", async (req, res) => {
    const pw = req.headers["x-admin-password"] as string | undefined;
    if (!pw || pw !== process.env.ADMIN_PASSWORD) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    try {
      const { getAllFeedback } = await import("../lib/store.js");
      const rows = await getAllFeedback();
      res.json({ data: rows });
    } catch (err) {
      console.error("[admin/feedback]", err);
      res.status(500).json({ error: "Internal error" });
    }
  });

  app.get("/admin/stats", async (req, res) => {
    const pw = req.headers["x-admin-password"] as string | undefined;
    if (!pw || pw !== process.env.ADMIN_PASSWORD) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    try {
      const { getAdminStats } = await import("../lib/store.js");
      res.json(await getAdminStats());
    } catch (err) {
      console.error("[admin/stats]", err);
      res.status(500).json({ error: "Internal error" });
    }
  });

  // GET /view/:token — render a full HTML email in the browser
  app.get("/view/:token", async (req, res) => {
    const { token } = req.params;

    try {
      const { getViewToken } = await import("../lib/reply-mode.js");
      const data = await getViewToken(token);

      if (!data) {
        res.status(410).send(viewErrorPage("Link expired", "This email preview link has expired (valid for 24 hours).<br>Open the message again from Discord to get a fresh link."));
        return;
      }

      const apiBase = process.env.FCE_API_BASE ?? "https://api2.freecustom.email/v1";
      const apiRes  = await fetch(`${apiBase}/inboxes/${encodeURIComponent(data.inbox)}/messages/${encodeURIComponent(data.messageId)}`, {
        headers: { Authorization: `Bearer ${data.apiKey}`, "User-Agent": "fce-discord-bot/1.0.0" },
      });

      if (!apiRes.ok) {
        res.status(404).send(viewErrorPage("Message not found", "This email may have been deleted."));
        return;
      }

      const json = await apiRes.json() as Record<string, unknown>;
      // Unwrap { data: {...} } envelope if present
      const raw  = (typeof json.data === "object" && json.data !== null ? json.data : json) as Record<string, unknown>;

      // Normalise field names — API versions may differ
      const msg = {
        from:              String(raw.from             ?? ""),
        subject:           String(raw.subject          ?? "(no subject)"),
        date:              String(raw.date             ?? raw.received_at ?? ""),
        body_html:         String(raw.body_html        ?? raw.html        ?? raw.body?.toString() ?? ""),
        body_text:         String(raw.body_text        ?? raw.text        ?? raw.plain_text       ?? ""),
        otp:               raw.otp               ? String(raw.otp)               : undefined,
        verification_link: raw.verification_link ? String(raw.verification_link) : undefined,
      };

      res.status(200).send(renderEmailPage(msg));
    } catch (err) {
      console.error("[view]", err);
      res.status(500).send(viewErrorPage("Error", "Could not load email. Try again."));
    }
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[auth] Callback server listening on :${PORT}`);
  });
}

function renderEmailPage(msg: {
  from?: string; subject?: string; date?: string;
  body_html?: string; body_text?: string;
  otp?: string; verification_link?: string;
}): string {
  const subject  = esc(msg.subject ?? "(no subject)");
  const from     = esc(msg.from ?? "");
  const date     = msg.date ? new Date(msg.date).toLocaleString() : "";
  const otp      = msg.otp && msg.otp !== "__DETECTED__" && msg.otp !== "__UPGRADE_REQUIRED__" ? esc(msg.otp) : "";
  const verifyLink = msg.verification_link ?? "";
  const bodyHtml = msg.body_html ?? "";
  const bodyText = msg.body_text ?? "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${subject} — FreeCustom.Email</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root { color-scheme: light dark; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #0d0d0d; color: #e5e5e5; min-height: 100vh; padding: 0; }
    .header { background: #111; border-bottom: 1px solid #222; padding: 14px 24px; display: flex; align-items: center; gap: 12px; }
    .logo { font-weight: 700; font-size: 14px; color: #fff; letter-spacing: -0.3px; text-decoration: none; }
    .logo:hover { opacity: 0.85; }
    .meta { max-width: 760px; margin: 24px auto; padding: 0 24px; }
    .meta-card { background: #141414; border: 1px solid #222; border-radius: 10px; padding: 20px 24px; }
    .subject { font-size: 20px; font-weight: 600; line-height: 1.3; margin-bottom: 16px; }
    .row { display: flex; gap: 8px; font-size: 13px; color: #999; margin-bottom: 6px; }
    .row strong { color: #e5e5e5; min-width: 60px; }
    .badges { display: flex; gap: 8px; margin-top: 16px; flex-wrap: wrap; }
    .otp-badge { background: #052e16; border: 1px solid #166534; color: #22c55e; padding: 8px 16px; border-radius: 8px; font-family: monospace; font-size: 22px; font-weight: 700; letter-spacing: 4px; }
    .btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 500; text-decoration: none; border: 1px solid #333; color: #e5e5e5; background: #1a1a1a; cursor: pointer; }
    .btn:hover { background: #222; }
    .btn-primary { background: #16a34a; border-color: #16a34a; color: #fff; }
    .btn-primary:hover { background: #15803d; }
    .body-wrap { max-width: 760px; margin: 0 auto 40px; padding: 0 24px; }
    .body-card { background: #fff; color: #111; border-radius: 10px; overflow: hidden; }
    .body-plain { background: #141414; color: #e5e5e5; border: 1px solid #222; border-radius: 10px; padding: 24px; font-size: 14px; line-height: 1.7; white-space: pre-wrap; word-break: break-word; }
    iframe { width: 100%; border: none; display: block; min-height: 400px; }
  </style>
</head>
<body>
  <div class="header">
    <a href="https://www.freecustom.email" class="logo">FreeCustom.Email Bot</a>
  </div>

  <div class="meta">
    <div class="meta-card">
      <div class="subject">${subject}</div>
      <div class="row"><strong>From</strong> <span>${from}</span></div>
      <div class="row"><strong>Date</strong> <span>${date}</span></div>
      ${otp ? `<div class="badges"><div class="otp-badge">${otp}</div></div>` : ""}
      ${verifyLink ? `<div class="badges"><a class="btn btn-primary" href="${esc(verifyLink)}" target="_blank" rel="noopener">✓ Verify account</a></div>` : ""}
    </div>
  </div>

  <div class="body-wrap">
    ${bodyHtml
      ? `<div class="body-card"><iframe src="data:text/html;base64,${Buffer.from(bodyHtml).toString("base64")}" sandbox="allow-same-origin" onload="this.style.height=this.contentWindow.document.body.scrollHeight+'px'"></iframe></div>`
      : bodyText
        ? `<div class="body-plain">${esc(bodyText)}</div>`
        : `<div class="body-plain" style="color:#666;font-style:italic">No message body.</div>`
    }
  </div>
  <div style="text-align:center;padding:24px;font-size:12px;color:#555"><a href="https://www.freecustom.email/api/discord" style="color:#555;text-decoration:none">get the bot for your server</a></div>
</body>
</html>`;
}

function viewErrorPage(title: string, body: string): string {
  return `<!DOCTYPE html><html><head><title>${title}</title><meta charset="utf-8">
  <style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#0d0d0d;color:#e5e5e5;}
  .box{text-align:center;max-width:400px;padding:2rem;}h1{color:#ef4444;margin-bottom:.75rem;}</style></head>
  <body><div class="box"><h1>${title}</h1><p>${body}</p></div></body></html>`;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
