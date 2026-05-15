import express from "express";
import { Client, MessageFlags } from "discord.js";
import { consumeLoginState } from "../lib/store.js";
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

      const { discordId, channelId } = result;

      // Fetch locale
      const { prisma } = await import("../lib/store.js");
      const user  = await prisma.user.findUnique({
        where:  { discordId },
        select: { locale: true },
      });
      const locale = user?.locale ?? "en-US";

      const successMsg = `${t(locale, "login.success")}\n${t(locale, "login.success_hint")}`;

      // 1. Post to the channel where /login was run (most reliable)
      if (channelId) {
        try {
          const { TextChannel } = await import("discord.js");
          const ch = await client.channels.fetch(channelId);
          if (ch instanceof TextChannel) {
            await ch.send(`<@${discordId}> ${successMsg}`);
          }
        } catch {
          // Channel unavailable — fall through to DM
        }
      }

      // 2. DM as fallback (works if user has DMs enabled)
      try {
        const dmUser = await client.users.fetch(discordId);
        await dmUser.send(successMsg);
      } catch {
        // DMs disabled — silently ignore
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[auth] Callback server listening on :${PORT}`);
  });
}
