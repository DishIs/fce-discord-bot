import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  MessageFlags,
} from "discord.js";
import { getUserApiKey, updateUserPlan } from "../lib/store.js";
import { FceApi } from "../lib/api.js";
import { statusEmbed } from "../lib/embed.js";
import { withApiError } from "../lib/upsell.js";
import { t } from "../i18n/index.js";
import { isOutputEphemeral } from "../lib/reply-mode.js";

export const data = new SlashCommandBuilder()
  .setName("status")
  .setDescription("Show your account plan and inbox counts");

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

  const api  = new FceApi(apiKey);
  const data = await withApiError(interaction, locale, () => api.getMe());
  if (!data) return;

  // Keep plan in sync
  await updateUserPlan(discordId, data.plan, data.plan_label);

  await interaction.editReply({ embeds: [statusEmbed(data)] });
}
