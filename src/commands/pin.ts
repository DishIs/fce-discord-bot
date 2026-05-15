import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  MessageFlags,
  PermissionFlagsBits,
  TextChannel,
  NewsChannel,
  ThreadChannel,
} from "discord.js";
import { getLastBotMessage } from "../lib/reply-mode.js";

export const data = new SlashCommandBuilder()
  .setName("pin")
  .setDescription("Pin the bot's most recent output in this channel")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (!interaction.guildId || !interaction.channelId) {
    await interaction.editReply({ content: "/pin only works in server channels." });
    return;
  }

  const perms = interaction.memberPermissions;
  const isAdmin = perms?.has(PermissionFlagsBits.Administrator) ||
                  perms?.has(PermissionFlagsBits.ManageMessages);

  if (!isAdmin) {
    await interaction.editReply({ content: "You need the **Manage Messages** permission to pin messages." });
    return;
  }

  const messageId = await getLastBotMessage(interaction.channelId);
  if (!messageId) {
    await interaction.editReply({
      content: "No recent bot output found in this channel to pin.\nMake sure output mode is set to **Public** so messages are pinnable.",
    });
    return;
  }

  const channel = interaction.channel;
  if (!channel || !(channel instanceof TextChannel || channel instanceof NewsChannel || channel instanceof ThreadChannel)) {
    await interaction.editReply({ content: "Cannot pin in this channel type." });
    return;
  }

  try {
    const message = await channel.messages.fetch(messageId);
    if (message.pinned) {
      await interaction.editReply({ content: "That message is already pinned." });
      return;
    }
    await message.pin();
    await interaction.editReply({ content: `✓ Pinned the bot's last output in <#${interaction.channelId}>.` });
  } catch {
    await interaction.editReply({
      content: "Could not pin — the message may have been deleted, or the bot lacks **Manage Messages** permission in this channel.",
    });
  }
}
