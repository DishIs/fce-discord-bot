import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  MessageFlags,
} from "discord.js";
import { getUser, addWatch, getUserWatches, countActiveWatches } from "../lib/store.js";
import { startWatch, stopWatch } from "../handlers/watch-manager.js";
import { watchListEmbed } from "../lib/embed.js";
import { requirePlan, withApiError } from "../lib/upsell.js";
import { t } from "../i18n/index.js";

const MAX_WATCHES = 5;

export const data = new SlashCommandBuilder()
  .setName("watch")
  .setDescription("Watch an inbox for real-time email delivery")
  .addSubcommand((sub) =>
    sub
      .setName("start")
      .setDescription("Start watching an inbox in this channel")
      .addStringOption((o) =>
        o.setName("inbox").setDescription("Email address to watch").setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("stop")
      .setDescription("Stop watching an inbox")
      .addStringOption((o) =>
        o.setName("inbox").setDescription("Email address to stop watching").setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub.setName("list").setDescription("List all active watches")
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const locale    = interaction.locale;
  const discordId = interaction.user.id;
  const user      = await getUser(discordId);

  if (!user?.apiKey) {
    await interaction.editReply({ content: t(locale, "errors.not_logged_in") });
    return;
  }

  const sub = interaction.options.getSubcommand();

  if (sub === "list") {
    const watches = await getUserWatches(discordId);
    await interaction.editReply({ embeds: [watchListEmbed(watches)] });
    return;
  }

  const inbox = interaction.options.getString("inbox", true);

  // Startup plan required for WebSocket watch (WS_PLANS = startup, growth, enterprise)
  const ok = await requirePlan(interaction, user.plan ?? "free", "startup", "Real-time watch", locale);
  if (!ok) return;

  if (sub === "start") {
    const count = await countActiveWatches(discordId);
    if (count >= MAX_WATCHES) {
      await interaction.editReply({ content: t(locale, "watch.limit") });
      return;
    }

    const channelId = interaction.channelId;
    const guildId   = interaction.guildId ?? undefined;

    // Check if already watching
    const existing = await getUserWatches(discordId);
    if (existing.some((w) => w.inbox === inbox)) {
      await interaction.editReply({
        content: t(locale, "watch.already", { inbox }),
      });
      return;
    }

    await addWatch(discordId, inbox, channelId, guildId);
    await startWatch(discordId, inbox, channelId, user.apiKey, user.locale ?? "en-US");

    await interaction.editReply({
      content: t(locale, "watch.started", { inbox, channel: `<#${channelId}>` }),
    });
    return;
  }

  if (sub === "stop") {
    const watches = await getUserWatches(discordId);
    if (!watches.some((w) => w.inbox === inbox)) {
      await interaction.editReply({
        content: t(locale, "watch.not_watching", { inbox }),
      });
      return;
    }

    await stopWatch(discordId, inbox, user.apiKey);
    await interaction.editReply({
      content: t(locale, "watch.stopped", { inbox }),
    });
  }
}
