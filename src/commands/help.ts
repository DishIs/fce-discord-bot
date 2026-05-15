import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  MessageFlags,
} from "discord.js";
import { helpEmbed } from "../lib/embed.js";
import { isOutputEphemeral } from "../lib/reply-mode.js";

export const data = new SlashCommandBuilder()
  .setName("help")
  .setDescription("Show all available commands");

export async function execute(interaction: ChatInputCommandInteraction) {
  const discordId = interaction.user.id;
  const ephemeral = await isOutputEphemeral(discordId, interaction.guildId);
  await interaction.reply({
    embeds: [helpEmbed()],
    ...(ephemeral ? { flags: MessageFlags.Ephemeral } : {}),
  });
}
