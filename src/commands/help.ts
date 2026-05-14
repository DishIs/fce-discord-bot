import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  MessageFlags,
} from "discord.js";
import { helpEmbed } from "../lib/embed.js";

export const data = new SlashCommandBuilder()
  .setName("help")
  .setDescription("Show all available commands");

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.reply({
    embeds: [helpEmbed()],
    flags: MessageFlags.Ephemeral,
  });
}
