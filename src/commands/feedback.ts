import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  MessageFlags,
} from "discord.js";
import { getUser } from "../lib/store.js";
import { feedbackPromptEmbed } from "../lib/embed.js";
import { t } from "../i18n/index.js";

export const data = new SlashCommandBuilder()
  .setName("feedback")
  .setDescription("Rate the bot and leave optional comments");

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const locale    = interaction.locale;
  const discordId = interaction.user.id;
  const user      = await getUser(discordId);

  if (!user) {
    await interaction.editReply({ content: t(locale, "errors.not_logged_in") });
    return;
  }

  const { embed, row } = feedbackPromptEmbed();
  await interaction.editReply({ embeds: [embed], components: [row] });
}
