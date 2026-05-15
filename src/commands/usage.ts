import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  MessageFlags,
} from "discord.js";
import { getUserApiKey } from "../lib/store.js";
import { FceApi } from "../lib/api.js";
import { usageEmbed } from "../lib/embed.js";
import { withApiError } from "../lib/upsell.js";
import { t } from "../i18n/index.js";
import { isOutputEphemeral } from "../lib/reply-mode.js";

export const data = new SlashCommandBuilder()
  .setName("usage")
  .setDescription("Show API request usage and remaining credits");

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
  const data = await withApiError(interaction, locale, () => api.getUsage());
  if (!data) return;

  const { embed, row } = usageEmbed(data);
  const components     = row ? [row] : [];
  await interaction.editReply({ embeds: [embed], components });
}
