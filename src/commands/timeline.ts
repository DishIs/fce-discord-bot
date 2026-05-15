import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  MessageFlags,
} from "discord.js";
import { getUserApiKey } from "../lib/store.js";
import { FceApi } from "../lib/api.js";
import { timelineEmbed } from "../lib/embed.js";
import { withApiError } from "../lib/upsell.js";
import { t } from "../i18n/index.js";
import { isOutputEphemeral } from "../lib/reply-mode.js";

export const data = new SlashCommandBuilder()
  .setName("timeline")
  .setDescription("Show email delivery timeline for an inbox")
  .addStringOption((o) =>
    o.setName("inbox").setDescription("Email address").setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const locale    = interaction.locale;
  const discordId = interaction.user.id;
  const ephemeral = await isOutputEphemeral(discordId, interaction.guildId);
  await interaction.deferReply(ephemeral ? { flags: MessageFlags.Ephemeral } : {});
  const apiKey    = await getUserApiKey(discordId);

  if (!apiKey) {
    await interaction.editReply({ content: t(locale, "errors.not_logged_in") });
    return;
  }

  const inbox  = interaction.options.getString("inbox", true);
  const api    = new FceApi(apiKey);
  const events = await withApiError(interaction, locale, () => api.getTimeline(inbox));
  if (!events) return;

  await interaction.editReply({ embeds: [timelineEmbed(inbox, events)] });
}
