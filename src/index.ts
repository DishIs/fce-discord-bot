import {
  Client,
  GatewayIntentBits,
  Collection,
  ChatInputCommandInteraction,
  ButtonInteraction,
  ModalSubmitInteraction,
  MessageFlags,
  ActionRowBuilder,
  TextInputBuilder,
  TextInputStyle,
  ModalBuilder,
} from "discord.js";
import { prisma, redis, getUser, saveFeedback, markFeedbackSent, getUserApiKey, updateLocale, upsertGuild, markGuildLeft, logCommand } from "./lib/store.js";
import { FceApi } from "./lib/api.js";
import { withApiError } from "./lib/upsell.js";
import { incrementCommandCount } from "./lib/store.js";
import { maybeSendFeedbackPrompt } from "./handlers/feedback-prompt.js";
import { startAuthServer } from "./handlers/auth-callback.js";
import { initWatchManager } from "./handlers/watch-manager.js";
import { t } from "./i18n/index.js";

// ── Command registry ──────────────────────────────────────────────────────────

import * as login     from "./commands/login.js";
import * as logout    from "./commands/logout.js";
import * as status    from "./commands/status.js";
import * as usage     from "./commands/usage.js";
import * as inbox     from "./commands/inbox.js";
import * as messages  from "./commands/messages.js";
import * as read      from "./commands/read.js";
import * as otp       from "./commands/otp.js";
import * as domains   from "./commands/domains.js";
import * as watch     from "./commands/watch.js";
import * as plans     from "./commands/plans.js";
import * as quickstart from "./commands/quickstart.js";
import * as timeline  from "./commands/timeline.js";
import * as insights  from "./commands/insights.js";
import * as help      from "./commands/help.js";
import * as guide     from "./commands/guide.js";
import * as support   from "./commands/support.js";
import * as ping      from "./commands/ping.js";
import * as me        from "./commands/me.js";
import * as feedback  from "./commands/feedback.js";
import * as format    from "./commands/format.js";

type CommandModule = {
  data: { name: string };
  execute: (i: ChatInputCommandInteraction) => Promise<void>;
};

const commandModules: CommandModule[] = [
  login, logout, status, usage, inbox, messages, read, otp,
  domains, watch, plans, quickstart, timeline, insights,
  help, guide, support, ping, me, feedback, format,
];

const commands = new Collection<string, CommandModule>();
for (const mod of commandModules) commands.set(mod.data.name, mod);

// ── Client ────────────────────────────────────────────────────────────────────

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.DirectMessages],
});

// ── Slash command handler ─────────────────────────────────────────────────────

client.on("interactionCreate", async (interaction) => {
  // ── Slash commands
  if (interaction.isChatInputCommand()) {
    const cmd = commands.get(interaction.commandName);
    if (!cmd) return;

    const t0 = Date.now();
    let success = true;
    try {
      await cmd.execute(interaction);
    } catch (err) {
      success = false;
      console.error(`[cmd:${interaction.commandName}]`, err);
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: "Something went wrong." }).catch(() => {});
      } else {
        await interaction.reply({ content: "Something went wrong.", flags: MessageFlags.Ephemeral }).catch(() => {});
      }
    } finally {
      const latencyMs = Date.now() - t0;
      const cmdName = interaction.commandName;
      const guildId = interaction.guildId ?? null;
      // Fire-and-forget — never blocks the response
      setImmediate(() => logCommand(interaction.user.id, cmdName, latencyMs, guildId, success));
    }

    if (!success) return;

    // Post-command: increment count + maybe prompt feedback
    const discordId = interaction.user.id;
    try {
      const count = await incrementCommandCount(discordId);
      await maybeSendFeedbackPrompt(client, discordId, count);
    } catch {
      // Never let telemetry crash a command
    }

    // Sync locale preference from Discord
    try {
      await updateLocale(discordId, interaction.locale);
    } catch {}

    return;
  }

  // ── Button interactions
  if (interaction.isButton()) {
    await handleButton(interaction);
    return;
  }

  // ── Modal submit
  if (interaction.isModalSubmit()) {
    await handleModal(interaction);
    return;
  }
});

// ── Button handler ────────────────────────────────────────────────────────────

async function handleButton(interaction: ButtonInteraction) {
  const { customId, user } = interaction;
  const locale             = interaction.locale;
  const discordId          = user.id;

  // Inbox remove confirmation
  if (customId.startsWith("inbox_remove_confirm:")) {
    const address = customId.split(":")[1];
    await interaction.deferUpdate();

    const apiKey = await getUserApiKey(discordId);
    if (!apiKey) {
      await interaction.editReply({ content: t(locale, "errors.not_logged_in"), components: [] });
      return;
    }

    const api = new FceApi(apiKey);
    const ok  = await withApiError(interaction as unknown as ChatInputCommandInteraction, locale, () =>
      api.unregisterInbox(address)
    );
    if (ok === null) return;

    await interaction.editReply({
      content: t(locale, "inbox.removed"),
      components: [],
    });
    return;
  }

  if (customId === "inbox_remove_cancel") {
    await interaction.update({ content: t(locale, "inbox.cancelled"), components: [] });
    return;
  }

  // Feedback star ratings: feedback_stars:N
  if (customId.startsWith("feedback_stars:")) {
    const stars = parseInt(customId.split(":")[1], 10);

    // Show comment modal
    const modal = new ModalBuilder()
      .setCustomId(`feedback_comment:${stars}`)
      .setTitle("Add a comment (optional)");

    const commentInput = new TextInputBuilder()
      .setCustomId("comment")
      .setLabel(t(locale, "feedback.comment_label"))
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder(t(locale, "feedback.comment_placeholder"))
      .setRequired(false)
      .setMaxLength(500);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(commentInput)
    );

    await interaction.showModal(modal);
    return;
  }

  // Feedback skip
  if (customId === "feedback_skip") {
    await interaction.update({
      content: t(locale, "feedback.skipped"),
      embeds: [],
      components: [],
    });
    await markFeedbackSent(discordId).catch(() => {});
    return;
  }
}

// ── Modal handler ─────────────────────────────────────────────────────────────

async function handleModal(interaction: ModalSubmitInteraction) {
  const { customId, user } = interaction;
  const locale             = interaction.locale;
  const discordId          = user.id;

  // Feedback comment modal
  if (customId.startsWith("feedback_comment:")) {
    const stars   = parseInt(customId.split(":")[1], 10);
    const comment = interaction.fields.getTextInputValue("comment") || null;

    await interaction.deferUpdate();

    try {
      const dbUser = await getUser(discordId);
      await saveFeedback(
        discordId,
        user.username,
        stars,
        comment,
        dbUser?.commandCount ?? 0
      );
    } catch (err) {
      console.error("[feedback]", err);
    }

    await interaction.editReply({
      content: t(locale, "feedback.thanks"),
      embeds: [],
      components: [],
    });
    return;
  }

  // Support modal
  if (customId === "support_modal") {
    const message = interaction.fields.getTextInputValue("support_message");
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const dbUser = await getUser(discordId);
      const body = {
        name:    user.username,
        email:   `discord:${discordId}@bot.freecustom.email`,
        subject: `[Discord Bot] Support ticket from ${user.username}`,
        message: `Discord user: ${user.username} (${discordId})\nPlan: ${dbUser?.planLabel ?? "unknown"}\nCommands run: ${dbUser?.commandCount ?? 0}\n\n---\n\n${message}`,
      };

      const contactUrl = process.env.FCE_CONTACT_URL ?? "https://www.freecustom.email/api/contact";
      const res = await fetch(contactUrl, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      });

      if (res.ok) {
        await interaction.editReply({ content: t(locale, "support.sent") });
      } else {
        await interaction.editReply({ content: t(locale, "support.failed") });
      }
    } catch {
      await interaction.editReply({ content: t(locale, "support.failed") });
    }
    return;
  }
}

// ── Guild lifecycle ───────────────────────────────────────────────────────────

client.on("guildCreate", (guild) => {
  upsertGuild(guild.id, guild.name, guild.memberCount).catch(() => {});
});

client.on("guildDelete", (guild) => {
  markGuildLeft(guild.id).catch(() => {});
});

// ── Bot ready ─────────────────────────────────────────────────────────────────

client.once("ready", async (c) => {
  console.log(`[bot] Logged in as ${c.user.tag}`);

  try {
    await redis.ping();
    console.log("[redis] Connected");
  } catch (err) {
    console.warn("[redis] Unavailable — login state will fall back to Postgres");
  }

  await initWatchManager(client);
  startAuthServer(client);
});

// ── Start ─────────────────────────────────────────────────────────────────────

client.login(process.env.DISCORD_TOKEN).catch((err) => {
  console.error("[bot] Login failed:", err);
  process.exit(1);
});

process.on("SIGTERM", async () => {
  console.log("[bot] Shutting down…");
  await prisma.$disconnect();
  client.destroy();
  process.exit(0);
});
