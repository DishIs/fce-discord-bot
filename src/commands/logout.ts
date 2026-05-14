import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  MessageFlags,
} from "discord.js";
import { getUser, deleteUser } from "../lib/store.js";
import { t } from "../i18n/index.js";
import { stopWatch } from "../handlers/watch-manager.js";

export const data = new SlashCommandBuilder()
  .setName("logout")
  .setDescription("Disconnect your FreeCustom.Email account");

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const locale    = interaction.locale;
  const discordId = interaction.user.id;
  const user      = await getUser(discordId);

  if (!user) {
    await interaction.editReply({ content: t(locale, "logout.not_logged_in") });
    return;
  }

  // Close any active WS watches before deleting
  const { prisma } = await import("../lib/store.js");
  const watches = await prisma.watch.findMany({ where: { discordId, active: true } });
  for (const w of watches) {
    if (user.apiKey) stopWatch(discordId, w.inbox, user.apiKey);
  }

  await deleteUser(discordId);
  await interaction.editReply({ content: t(locale, "logout.success") });
}
