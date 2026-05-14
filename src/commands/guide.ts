import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} from "discord.js";
import { t } from "../i18n/index.js";

export const data = new SlashCommandBuilder()
  .setName("guide")
  .setDescription("Step-by-step onboarding guide");

export async function execute(interaction: ChatInputCommandInteraction) {
  const locale = interaction.locale;

  const embed = new EmbedBuilder()
    .setColor(0x1a1a1a)
    .setTitle("FreeCustom.Email — Getting Started")
    .addFields(
      { name: t(locale, "guide.step1_title"), value: t(locale, "guide.step1_desc") },
      { name: t(locale, "guide.step2_title"), value: t(locale, "guide.step2_desc") },
      { name: t(locale, "guide.step3_title"), value: t(locale, "guide.step3_desc") },
      { name: t(locale, "guide.step4_title"), value: t(locale, "guide.step4_desc") },
      { name: t(locale, "guide.done_title"),  value: t(locale, "guide.done_desc") }
    )
    .setFooter({ text: "freecustom.email · Run /help to see all commands" });

  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}
