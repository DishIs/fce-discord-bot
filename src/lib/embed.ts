import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ColorResolvable,
} from "discord.js";

// ── Brand constants ───────────────────────────────────────────────────────────

const COLOR_DEFAULT  = 0x1a1a1a as ColorResolvable;
const COLOR_SUCCESS  = 0x22c55e as ColorResolvable;
const COLOR_ERROR    = 0xef4444 as ColorResolvable;
const COLOR_WARN     = 0xf59e0b as ColorResolvable;
const COLOR_UPGRADE  = 0x6366f1 as ColorResolvable;
const FOOTER_TEXT    = "freecustom.email  ·  fce bot";

const FCE_SITE = process.env.FCE_SITE_URL ?? "https://www.freecustom.email";

// ── Base builder ──────────────────────────────────────────────────────────────

function base(color: ColorResolvable = COLOR_DEFAULT): EmbedBuilder {
  return new EmbedBuilder().setColor(color).setFooter({ text: FOOTER_TEXT });
}

// ── Generic embeds ────────────────────────────────────────────────────────────

export function successEmbed(title: string, description?: string): EmbedBuilder {
  const e = base(COLOR_SUCCESS).setTitle(`✓ ${title}`);
  if (description) e.setDescription(description);
  return e;
}

export function errorEmbed(description: string): EmbedBuilder {
  return base(COLOR_ERROR).setDescription(description);
}

export function infoEmbed(title: string, description?: string): EmbedBuilder {
  const e = base().setTitle(title);
  if (description) e.setDescription(description);
  return e;
}

export function warnEmbed(description: string): EmbedBuilder {
  return base(COLOR_WARN).setDescription(description);
}

// ── Login ─────────────────────────────────────────────────────────────────────

export function loginEmbed(authUrl: string): {
  embed: EmbedBuilder;
  row: ActionRowBuilder<ButtonBuilder>;
} {
  const embed = base()
    .setTitle("◉ FreeCustom.Email")
    .setDescription(
      "Click the button below to connect your account.\nThis link expires in **3 minutes**.\n\nAfter logging in, return here — the bot updates automatically."
    );

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setLabel("Login with FreeCustom.Email")
      .setStyle(ButtonStyle.Link)
      .setURL(authUrl)
      .setEmoji("🔑")
  );

  return { embed, row };
}

// ── Status ────────────────────────────────────────────────────────────────────

export function statusEmbed(data: {
  plan:            string;
  plan_label:      string;
  price:           string;
  credits:         number;
  api_inbox_count: number;
  app_inbox_count: number;
}): EmbedBuilder {
  return base()
    .setTitle("Account")
    .addFields(
      { name: "Plan",        value: `\`${data.plan_label}\``,              inline: true  },
      { name: "Price",       value: data.price,                            inline: true  },
      { name: "​",      value: "​",                              inline: true  },
      { name: "Credits",     value: `${data.credits.toLocaleString()} remaining`, inline: true },
      { name: "API inboxes", value: String(data.api_inbox_count),          inline: true  },
      { name: "App inboxes", value: String(data.app_inbox_count),          inline: true  }
    );
}

// ── Usage ─────────────────────────────────────────────────────────────────────

export function usageEmbed(data: {
  requests_used:      number;
  requests_limit:     number;
  requests_remaining: number;
  percent_used:       string;
  credits_remaining:  number;
  resets:             string;
}): { embed: EmbedBuilder; row?: ActionRowBuilder<ButtonBuilder> } {
  const pct   = parseFloat(data.percent_used);
  const warn  = pct >= 80;
  const bar   = progressBar(data.requests_used, data.requests_limit);
  const embed = base(warn ? COLOR_WARN : COLOR_DEFAULT)
    .setTitle("Request Usage")
    .setDescription(`${bar}\n\`${data.requests_used.toLocaleString()} / ${data.requests_limit.toLocaleString()}\` requests`)
    .addFields(
      { name: "Remaining",        value: data.requests_remaining.toLocaleString(), inline: true },
      { name: "Credits",          value: data.credits_remaining.toLocaleString(),  inline: true },
      { name: "Resets",           value: data.resets,                              inline: true },
    );

  if (warn) {
    embed.addFields({ name: "⚠", value: "Usage above 80% — consider topping up.", inline: false });
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setLabel("Add credits")
        .setStyle(ButtonStyle.Link)
        .setURL(`${FCE_SITE}/api/pricing?scroll=credits&utm_source=discord_usage`),
      new ButtonBuilder()
        .setLabel("Upgrade plan")
        .setStyle(ButtonStyle.Link)
        .setURL(`${FCE_SITE}/api/pricing?utm_source=discord_usage_warn`)
    );
    return { embed, row };
  }
  return { embed };
}

function progressBar(used: number, limit: number, width = 20): string {
  const pct    = Math.min(used / Math.max(limit, 1), 1);
  const filled = Math.round(pct * width);
  const empty  = width - filled;
  return `\`[${"█".repeat(filled)}${"░".repeat(empty)}] ${Math.round(pct * 100)}%\``;
}

// ── Inboxes ───────────────────────────────────────────────────────────────────

export function inboxListEmbed(inboxes: Array<{ inbox: string }>): EmbedBuilder {
  if (inboxes.length === 0) {
    return base()
      .setTitle("Your Inboxes")
      .setDescription("No inboxes registered yet.\nUse `/inbox add` or `/quickstart` to create one.");
  }
  return base()
    .setTitle(`Your Inboxes (${inboxes.length})`)
    .setDescription(inboxes.map((i) => `\`${i.inbox}\``).join("\n"));
}

// ── Messages ──────────────────────────────────────────────────────────────────

export function messagesEmbed(
  inbox:    string,
  messages: Array<{
    id:      string;
    from:    string;
    subject: string;
    date:    string;
    otp?:    string;
  }>
): EmbedBuilder {
  if (messages.length === 0) {
    return base()
      .setTitle(`Messages in ${inbox}`)
      .setDescription("No messages yet.\nEmails sent to this address will appear here.");
  }

  const lines = messages.slice(0, 5).map((m) => {
    const otp  = m.otp && m.otp !== "__DETECTED__" ? `  \`OTP: ${m.otp}\`` : "";
    return `**\`${m.id.slice(0, 8)}\`**  ${truncate(m.from, 28)}\n└ ${truncate(m.subject, 40)}${otp}  · ${relativeTime(m.date)}`;
  });

  return base()
    .setTitle(`Messages in ${inbox}`)
    .setDescription(lines.join("\n\n"))
    .setFooter({ text: `Use /read ${inbox} <id> to open · ${FOOTER_TEXT}` });
}

// ── Single message ────────────────────────────────────────────────────────────

export function messageEmbed(msg: {
  id:                string;
  from:              string;
  subject:           string;
  date:              string;
  otp?:              string;
  verification_link?: string;
  body_text?:        string;
}): EmbedBuilder {
  const e = base()
    .setTitle("Message")
    .addFields(
      { name: "From",    value: msg.from,           inline: true },
      { name: "Subject", value: msg.subject,         inline: true },
      { name: "Date",    value: relativeTime(msg.date), inline: true }
    );

  if (msg.otp && msg.otp !== "__DETECTED__") {
    e.addFields({ name: "OTP", value: `\`${msg.otp}\``, inline: true });
  }
  if (msg.verification_link) {
    e.addFields({ name: "Verify link", value: `[Click to verify](${msg.verification_link})`, inline: true });
  }
  if (msg.body_text) {
    const body = msg.body_text.replace(/\s+/g, " ").trim().slice(0, 800);
    e.addFields({ name: "Body", value: `\`\`\`${body}\`\`\`` });
  }

  return e;
}

// ── OTP ───────────────────────────────────────────────────────────────────────

export function otpEmbed(data: {
  otp:               string;
  from:              string;
  subject:           string;
  timestamp:         number;
  verification_link?: string;
}): EmbedBuilder {
  const e = base(COLOR_SUCCESS)
    .setTitle("OTP")
    .setDescription(`# \`${data.otp}\``)
    .addFields(
      { name: "From",     value: data.from,                           inline: true },
      { name: "Subject",  value: truncate(data.subject, 40),          inline: true },
      { name: "Received", value: `<t:${Math.floor(data.timestamp / 1000)}:R>`, inline: true }
    );
  if (data.verification_link) {
    e.addFields({ name: "Verify link", value: `[Click to verify](${data.verification_link})` });
  }
  return e;
}

// ── Domains ───────────────────────────────────────────────────────────────────

export function domainsEmbed(
  domains: Array<{ domain: string; tier: string }>
): EmbedBuilder {
  if (domains.length === 0) {
    return base().setTitle("Available Domains").setDescription("No domains available on your plan.");
  }
  const lines = domains.map((d) => {
    const badge = d.tier === "pro" ? " `pro`" : d.tier === "fresh" ? " `fresh`" : "";
    return `\`${d.domain}\`${badge}`;
  });
  return base().setTitle(`Available Domains (${domains.length})`).setDescription(lines.join("\n"));
}

// ── Plans ─────────────────────────────────────────────────────────────────────

export function plansEmbed(currentPlan: string): {
  embed: EmbedBuilder;
  rows:  ActionRowBuilder<ButtonBuilder>[];
} {
  const embed = base()
    .setTitle("API Plans")
    .setDescription(`Your current plan: \`${currentPlan}\`\n\nChoose a plan that fits your usage.`)
    .addFields(
      { name: "Free · $0",           value: "1k req/mo · 10 inboxes · Shared pool",                              inline: false },
      { name: "Developer · $10/mo",  value: "50k req/mo · 25 inboxes · Wait API · OTP",                          inline: false },
      { name: "Startup · $29/mo",    value: "250k req/mo · 40 inboxes",                                           inline: false },
      { name: "Growth · $89/mo ⭐",  value: "1M req/mo · 100 inboxes · WebSocket watch · Custom domains · MCP",  inline: false },
      { name: "Enterprise · $199/mo", value: "10M req/mo · Unlimited inboxes · 99.5% SLA",                       inline: false },
    );

  const plans = ["developer", "startup", "growth", "enterprise"];
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];

  // Two rows of buttons (max 5 per row)
  const row1 = new ActionRowBuilder<ButtonBuilder>();
  for (const p of plans) {
    row1.addComponents(
      new ButtonBuilder()
        .setLabel(`Upgrade to ${p.charAt(0).toUpperCase() + p.slice(1)}`)
        .setStyle(ButtonStyle.Link)
        .setURL(`${FCE_SITE}/api/pricing?plan=${p}&utm_source=discord_plans`)
    );
  }
  rows.push(row1);

  return { embed, rows };
}

// ── Watch alert (real-time email push) ───────────────────────────────────────

export function watchAlertEmbed(data: {
  inbox:             string;
  from:              string;
  subject:           string;
  otp?:              string;
  verification_link?: string;
  timestamp?:        number;
}): EmbedBuilder {
  const e = base(COLOR_SUCCESS)
    .setTitle("📬 New email")
    .setDescription(`**${data.inbox}**`)
    .addFields(
      { name: "From",    value: data.from,             inline: true },
      { name: "Subject", value: truncate(data.subject, 40), inline: true },
    );

  if (data.otp && data.otp !== "__DETECTED__") {
    e.addFields({ name: "OTP", value: `\`${data.otp}\``, inline: true });
  }
  if (data.verification_link) {
    e.addFields({ name: "Verify link", value: `[Click to verify](${data.verification_link})`, inline: true });
  }
  if (data.timestamp) {
    e.setTimestamp(data.timestamp);
  }
  return e;
}

// ── Plan gate (upsell) ────────────────────────────────────────────────────────

export function planGateEmbed(
  requiredPlan: string,
  feature:      string,
  currentPlan:  string
): { embed: EmbedBuilder; row: ActionRowBuilder<ButtonBuilder> } {
  const embed = base(COLOR_UPGRADE)
    .setTitle(`⚡ ${requiredPlan.charAt(0).toUpperCase() + requiredPlan.slice(1)} plan required`)
    .setDescription(`**${feature}** is available on ${requiredPlan} and above.\n\nYour current plan: \`${currentPlan}\``)
    .addFields({ name: "Upgrade to unlock", value: `→ [View ${requiredPlan} plan](${FCE_SITE}/api/pricing?plan=${requiredPlan}&utm_source=discord_gate)` });

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setLabel(`See ${requiredPlan.charAt(0).toUpperCase() + requiredPlan.slice(1)} plan`)
      .setStyle(ButtonStyle.Link)
      .setURL(`${FCE_SITE}/api/pricing?plan=${requiredPlan}&utm_source=discord_gate`)
  );

  return { embed, row };
}

// ── Rate limit error with usage ───────────────────────────────────────────────

export function rateLimitEmbed(
  used:      number,
  limit:     number,
  credits:   number,
  resets:    string
): { embed: EmbedBuilder; row: ActionRowBuilder<ButtonBuilder> } {
  const embed = base(COLOR_ERROR)
    .setTitle("✗ Rate limit hit")
    .addFields(
      { name: "Used",    value: `${used.toLocaleString()} / ${limit.toLocaleString()}`, inline: true },
      { name: "Credits", value: String(credits),                                         inline: true },
      { name: "Resets",  value: resets,                                                  inline: true },
    );

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setLabel("Add credits")
      .setStyle(ButtonStyle.Link)
      .setURL(`${FCE_SITE}/api/pricing?scroll=credits&utm_source=discord_ratelimit`),
    new ButtonBuilder()
      .setLabel("Upgrade plan")
      .setStyle(ButtonStyle.Link)
      .setURL(`${FCE_SITE}/api/pricing?utm_source=discord_ratelimit`)
  );

  return { embed, row };
}

// ── Feedback prompt ───────────────────────────────────────────────────────────

export function feedbackPromptEmbed(): {
  embed: EmbedBuilder;
  row:   ActionRowBuilder<ButtonBuilder>;
} {
  const embed = base()
    .setTitle("Quick rating?")
    .setDescription(
      "You've been using the FCE bot for a while — mind leaving a 5-second rating?\nIt really helps us improve."
    );

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("feedback_stars:1").setLabel("★").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("feedback_stars:2").setLabel("★★").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("feedback_stars:3").setLabel("★★★").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("feedback_stars:4").setLabel("★★★★").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("feedback_stars:5").setLabel("★★★★★").setStyle(ButtonStyle.Primary),
  );

  return { embed, row };
}

export function feedbackSkipRow(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("feedback_skip").setLabel("Skip — don't ask again").setStyle(ButtonStyle.Secondary)
  );
}

// ── Help ──────────────────────────────────────────────────────────────────────

export function helpEmbed(): EmbedBuilder {
  return base()
    .setTitle("◉ FreeCustom.Email Bot")
    .setDescription(
      "Disposable inboxes, OTP extraction, and real-time email — right in Discord."
    )
    .addFields(
      {
        name: "🚀 Getting Started",
        value: [
          "`/login`  — Connect your account",
          "`/quickstart`  — Instant inbox + watch in one command",
          "`/guide`  — Step-by-step onboarding",
          "`/status`  — View your account & plan",
        ].join("\n"),
      },
      {
        name: "📬 Inbox & Messages",
        value: [
          "`/inbox list`  — All your inboxes",
          "`/inbox add [address]`  — Register new inbox",
          "`/inbox remove <address>`  — Unregister",
          "`/messages <inbox>`  — List messages",
          "`/read <inbox> <id>`  — Open a message",
        ].join("\n"),
      },
      {
        name: "⚡ Power Features",
        value: [
          "`/otp <inbox>`  — Latest OTP  *(Growth+)*",
          "`/watch <inbox>`  — Real-time email alerts  *(Growth+)*",
          "`/unwatch <inbox>`  — Stop watching",
          "`/timeline <inbox>`  — Event timeline  *(Growth+)*",
          "`/insights <inbox>`  — Delivery insights  *(Growth+)*",
          "`/domains`  — Available domains",
        ].join("\n"),
      },
      {
        name: "💳 Plans & Billing",
        value: [
          "`/plans`  — Compare all API plans",
          "`/upgrade <plan>`  — Go to checkout",
          "`/credits`  — Buy extra request credits",
          "`/usage`  — Request usage this month",
        ].join("\n"),
      },
      {
        name: "🛟 Help & Support",
        value: [
          "`/help`  — This menu",
          "`/docs [topic]`  — Jump to API docs",
          "`/support <message>`  — Contact the team",
          "`/bug <description>`  — Report an issue",
          "`/ping`  — Bot & API latency",
          "`/changelog`  — Latest updates",
          "`/feedback`  — Leave a rating",
        ].join("\n"),
      },
    )
    .setFooter({ text: "freecustom.email  ·  /guide for step-by-step onboarding" });
}

// ── Timeline ──────────────────────────────────────────────────────────────────

export function timelineEmbed(
  inbox:  string,
  events: Array<{ type: string; latency_ms?: number }>
): EmbedBuilder {
  if (events.length === 0) {
    return base().setTitle(`Timeline — ${inbox}`).setDescription("No events found.");
  }
  const lines = events.map((e) => {
    const lat = e.latency_ms != null ? `  \`+${e.latency_ms}ms\`` : "";
    return `· \`${e.type}\`${lat}`;
  });
  return base().setTitle(`Timeline — ${inbox}`).setDescription(lines.join("\n"));
}

// ── Insights ──────────────────────────────────────────────────────────────────

export function insightsEmbed(
  inbox:    string,
  insights: Array<{ type: string; message: string }>
): EmbedBuilder {
  if (insights.length === 0) {
    return base(COLOR_SUCCESS)
      .setTitle(`Insights — ${inbox}`)
      .setDescription("✓ No issues detected. Delivery looks healthy.");
  }
  const lines = insights.map((i) => `**[${i.type}]** ${i.message}`);
  return base(COLOR_WARN).setTitle(`Insights — ${inbox}`).setDescription(lines.join("\n"));
}

// ── Quickstart ────────────────────────────────────────────────────────────────

export function quickstartEmbed(inbox: string, hasWatch: boolean): {
  embed: EmbedBuilder;
  row?:  ActionRowBuilder<ButtonBuilder>;
} {
  const embed = base(COLOR_SUCCESS)
    .setTitle("✓ Inbox ready")
    .setDescription(
      hasWatch
        ? "Watching for emails in real-time. Send an email to the address below."
        : "Inbox registered. Emails are accessible via `/messages`."
    )
    .addFields({ name: "Your address", value: `\`${inbox}\`` });

  if (!hasWatch) {
    embed.addFields({ name: "Real-time watch", value: "Requires Growth plan.\n→ `/messages` to check manually." });
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setLabel("Upgrade to Growth")
        .setStyle(ButtonStyle.Link)
        .setURL(`${FCE_SITE}/api/pricing?plan=growth&utm_source=discord_quickstart`)
    );
    return { embed, row };
  }

  return { embed };
}

// ── Watch list ────────────────────────────────────────────────────────────────

export function watchListEmbed(
  watches: Array<{ inbox: string; channelId: string }>
): EmbedBuilder {
  if (watches.length === 0) {
    return base()
      .setTitle("Active Watches")
      .setDescription("No active watches. Use `/watch start <inbox>` to begin.");
  }
  const lines = watches.map((w) => `\`${w.inbox}\`  →  <#${w.channelId}>`);
  return base()
    .setTitle(`Active Watches (${watches.length})`)
    .setDescription(lines.join("\n"));
}

// ── Utils ─────────────────────────────────────────────────────────────────────

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m    = Math.floor(diff / 60000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
