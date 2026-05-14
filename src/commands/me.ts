import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  MessageFlags,
} from "discord.js";
import { getUser } from "../lib/store.js";
import { FceApi } from "../lib/api.js";
import { withApiError } from "../lib/upsell.js";
import { planBadge } from "../lib/plan.js";
import { t } from "../i18n/index.js";

export const data = new SlashCommandBuilder()
  .setName("me")
  .setDescription("Show raw account details from the API");

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const locale    = interaction.locale;
  const discordId = interaction.user.id;
  const user      = await getUser(discordId);

  if (!user?.apiKey) {
    await interaction.editReply({ content: t(locale, "errors.not_logged_in") });
    return;
  }

  const api  = new FceApi(user.apiKey);
  const data = await withApiError(interaction, locale, () => api.getRawMe());
  if (!data) return;

  const json = JSON.stringify(data, null, 2);
  const truncated = json.length > 1800 ? json.slice(0, 1800) + "\n…" : json;

  const embed = new EmbedBuilder()
    .setColor(0x1a1a1a)
    .setTitle("Raw account data")
    .setDescription("```json\n" + truncated + "\n```");

  await interaction.editReply({ embeds: [embed] });
}
