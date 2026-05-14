import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  MessageFlags,
} from "discord.js";
import { getUser } from "../lib/store.js";
import { plansEmbed } from "../lib/embed.js";
import { t } from "../i18n/index.js";

export const data = new SlashCommandBuilder()
  .setName("plans")
  .setDescription("View available API plans and pricing");

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const locale    = interaction.locale;
  const discordId = interaction.user.id;
  const user      = await getUser(discordId);

  const { embed, rows } = plansEmbed(user?.plan ?? "free");
  await interaction.editReply({ embeds: [embed], components: rows });
}
