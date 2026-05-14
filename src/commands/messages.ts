import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  MessageFlags,
} from "discord.js";
import { getUserApiKey } from "../lib/store.js";
import { FceApi } from "../lib/api.js";
import { messagesEmbed } from "../lib/embed.js";
import { withApiError } from "../lib/upsell.js";
import { t } from "../i18n/index.js";

export const data = new SlashCommandBuilder()
  .setName("messages")
  .setDescription("List recent emails in an inbox")
  .addStringOption((o) =>
    o.setName("inbox").setDescription("Email address").setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const locale    = interaction.locale;
  const discordId = interaction.user.id;
  const apiKey    = await getUserApiKey(discordId);

  if (!apiKey) {
    await interaction.editReply({ content: t(locale, "errors.not_logged_in") });
    return;
  }

  const inbox    = interaction.options.getString("inbox", true);
  const api      = new FceApi(apiKey);
  const messages = await withApiError(interaction, locale, () => api.listMessages(inbox));
  if (!messages) return;

  await interaction.editReply({ embeds: [messagesEmbed(inbox, messages)] });
}
