import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  MessageFlags,
} from "discord.js";
import { isOutputEphemeral } from "../lib/reply-mode.js";

export const data = new SlashCommandBuilder()
  .setName("ping")
  .setDescription("Check bot latency");

export async function execute(interaction: ChatInputCommandInteraction) {
  const start     = Date.now();
  const discordId = interaction.user.id;
  const ephemeral = await isOutputEphemeral(discordId, interaction.guildId);
  await interaction.deferReply(ephemeral ? { flags: MessageFlags.Ephemeral } : {});
  const latency = Date.now() - start;
  await interaction.editReply(
    `🏓 Pong! Bot: **${latency}ms** · WS: **${interaction.client.ws.ping}ms**`
  );
}
