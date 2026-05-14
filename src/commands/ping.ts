import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  MessageFlags,
} from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("ping")
  .setDescription("Check bot latency");

export async function execute(interaction: ChatInputCommandInteraction) {
  const start = Date.now();
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const latency = Date.now() - start;
  await interaction.editReply(
    `🏓 Pong! Bot: **${latency}ms** · WS: **${interaction.client.ws.ping}ms**`
  );
}
