import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  MessageFlags,
} from "discord.js";
import { getUser } from "../lib/store.js";
import { t } from "../i18n/index.js";

export const data = new SlashCommandBuilder()
  .setName("support")
  .setDescription("Submit a support ticket — we'll reply to your Discord DM");

export async function execute(interaction: ChatInputCommandInteraction) {
  const locale = interaction.locale;

  const modal = new ModalBuilder()
    .setCustomId("support_modal")
    .setTitle("Contact Support");

  const messageInput = new TextInputBuilder()
    .setCustomId("support_message")
    .setLabel("Describe your issue")
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder("Tell us what happened…")
    .setRequired(true)
    .setMinLength(20)
    .setMaxLength(1000);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(messageInput)
  );

  await interaction.showModal(modal);
}
