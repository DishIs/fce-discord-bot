import {
  ChatInputCommandInteraction,
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { planGateEmbed } from "./embed.js";
import { hasPlan, type PlanName } from "./plan.js";
import { FceApiError } from "./api.js";
import { t } from "../i18n/index.js";

const PRICING_BASE = process.env.FCE_PRICING_URL ?? "https://www.freecustom.email/api/pricing";
const FCE_SITE     = process.env.FCE_SITE_URL    ?? "https://www.freecustom.email";

export function planGateUrl(plan: PlanName): string {
  return `${PRICING_BASE}?plan=${plan}&utm_source=discord_gate&utm_medium=bot`;
}

export function upgradeUrl(plan: PlanName): string {
  return `${PRICING_BASE}?plan=${plan}&utm_source=discord_upgrade&utm_medium=bot`;
}

// ── Plan gate ─────────────────────────────────────────────────────────────────

export async function requirePlan(
  interaction: ChatInputCommandInteraction,
  userPlan:    string,
  required:    PlanName,
  feature:     string,
  locale:      string
): Promise<boolean> {
  if (hasPlan(userPlan, required)) return true;
  const { embed, row } = planGateEmbed(required, feature, userPlan);
  await interaction.editReply({ embeds: [embed], components: [row] });
  return false;
}

// ── Contextual API error mapping ──────────────────────────────────────────────

export interface ApiErrorContext {
  inbox?:   string;
  command?: string;
}

function friendlyApiError(
  err: FceApiError,
  ctx: ApiErrorContext
): { content: string; components: ActionRowBuilder<ButtonBuilder>[] } {
  const raw = err.message;
  const low = raw.toLowerCase();

  // ── Inbox not registered ─────────────────────────────────────────────────
  if (low.includes("register") && (low.includes("inbox") || low.includes("post /v1/inboxes"))) {
    const addr = ctx.inbox ?? "<address>";
    const components: ActionRowBuilder<ButtonBuilder>[] = [];
    if (ctx.inbox) {
      components.push(
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`quick_register:${ctx.inbox}`)
            .setLabel("Register inbox")
            .setStyle(ButtonStyle.Primary)
            .setEmoji("📬"),
          new ButtonBuilder()
            .setCustomId("nav_inbox_list")
            .setLabel("My inboxes")
            .setStyle(ButtonStyle.Secondary)
        )
      );
    }
    return {
      content: [
        `**Inbox not registered**`,
        `\`${addr}\` isn't in your account yet.`,
        ``,
        `> **Why:** The FCE API only accepts requests for inboxes you've explicitly registered.`,
        `> **Fix:** Register it first with \`/inbox add ${addr}\`, then retry.`,
      ].join("\n"),
      components,
    };
  }

  // ── Inbox / resource not found (404) ─────────────────────────────────────
  if (err.status === 404) {
    const components: ActionRowBuilder<ButtonBuilder>[] = [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("nav_inbox_list")
          .setLabel("My inboxes")
          .setStyle(ButtonStyle.Secondary)
      ),
    ];
    return {
      content: [
        `**Not found**`,
        ctx.inbox
          ? `\`${ctx.inbox}\` wasn't found — it may have been deleted or never registered.`
          : raw,
        ``,
        `> Use \`/inbox list\` to see your active inboxes.`,
      ].join("\n"),
      components,
    };
  }

  // ── No OTP / no messages ──────────────────────────────────────────────────
  if (low.includes("no otp") || low.includes("otp not found") || low.includes("no recent otp")) {
    const addr = ctx.inbox ?? "<inbox>";
    return {
      content: [
        `**No OTP found**`,
        `No recent OTP code arrived at \`${addr}\`.`,
        ``,
        `> **Why:** The OTP extractor looks at the last few emails. If the email hasn't arrived yet, wait a moment.`,
        `> **Fix:** Check \`/messages ${addr}\` to confirm the email is there, then retry \`/otp ${addr}\`.`,
      ].join("\n"),
      components: [],
    };
  }

  if (low.includes("no messages") || low.includes("inbox is empty")) {
    const addr = ctx.inbox ?? "<inbox>";
    return {
      content: [
        `**No messages yet**`,
        `\`${addr}\` is empty — no emails have arrived.`,
        ``,
        `> Send an email to this address and check back. Use \`/watch start ${addr}\` to get notified instantly.`,
      ].join("\n"),
      components: [],
    };
  }

  // ── Auth failure (401 / 403) ──────────────────────────────────────────────
  if (err.status === 401 || err.status === 403) {
    return {
      content: [
        `**Authentication failed**`,
        `Your API key may have expired or been revoked.`,
        ``,
        `> Run \`/login\` to reconnect your account.`,
      ].join("\n"),
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId("trigger_login")
            .setLabel("Re-login")
            .setStyle(ButtonStyle.Primary)
            .setEmoji("🔑")
        ),
      ],
    };
  }

  // ── Quota / payment required (402) ───────────────────────────────────────
  if (err.status === 402) {
    return {
      content: [
        `**Quota exceeded**`,
        raw,
        ``,
        `> Upgrade your plan or add credits to continue.`,
      ].join("\n"),
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setLabel("Add credits")
            .setStyle(ButtonStyle.Link)
            .setURL(`${FCE_SITE}/api/pricing?scroll=credits&utm_source=discord_402`),
          new ButtonBuilder()
            .setLabel("Upgrade plan")
            .setStyle(ButtonStyle.Link)
            .setURL(`${FCE_SITE}/api/pricing?utm_source=discord_402`)
        ),
      ],
    };
  }

  // ── Rate limit (429) ─────────────────────────────────────────────────────
  if (err.status === 429) {
    return {
      content: [
        `**Rate limit reached**`,
        `You've used all your requests for this period.`,
        ``,
        `> Add credits for instant top-up, or wait for your monthly quota to reset.`,
      ].join("\n"),
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setLabel("Add credits")
            .setStyle(ButtonStyle.Link)
            .setURL(`${FCE_SITE}/api/pricing?scroll=credits&utm_source=discord_ratelimit`),
          new ButtonBuilder()
            .setLabel("Check usage")
            .setCustomId("nav_usage")
            .setStyle(ButtonStyle.Secondary)
        ),
      ],
    };
  }

  // ── Plan required (mentioned in error body) ───────────────────────────────
  if (low.includes("plan") || low.includes("upgrade") || low.includes("tier")) {
    return {
      content: [
        `**Plan required**`,
        raw,
        ``,
        `> View available plans and upgrade to unlock this feature.`,
      ].join("\n"),
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setLabel("View plans")
            .setStyle(ButtonStyle.Link)
            .setURL(`${FCE_SITE}/api/pricing?utm_source=discord_plan_err`)
        ),
      ],
    };
  }

  // ── Generic fallback ─────────────────────────────────────────────────────
  return {
    content: [
      `**Something went wrong**`,
      raw,
      ``,
      `> If this keeps happening, run \`/support\` to contact us.`,
    ].join("\n"),
    components: [],
  };
}

// ── Main wrapper ──────────────────────────────────────────────────────────────

export async function withApiError<T>(
  interaction: ChatInputCommandInteraction,
  locale:      string,
  fn:          () => Promise<T>,
  ctx:         ApiErrorContext = {}
): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof FceApiError) {
      const { content, components } = friendlyApiError(err, ctx);
      await interaction.editReply({ content, components }).catch(() => {});
      return null;
    }
    console.error("[api]", err);
    await interaction.editReply({ content: t(locale, "errors.unknown") }).catch(() => {});
    return null;
  }
}
