import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  MessageFlags,
} from "discord.js";
import { getUser, addWatch, countActiveWatches } from "../lib/store.js";
import { FceApi, randomInbox } from "../lib/api.js";
import { startWatch } from "../handlers/watch-manager.js";
import { quickstartEmbed } from "../lib/embed.js";
import { hasPlan } from "../lib/plan.js";
import { withApiError } from "../lib/upsell.js";
import { t } from "../i18n/index.js";

export const data = new SlashCommandBuilder()
  .setName("quickstart")
  .setDescription("Generate a fresh inbox and start watching — one command setup");

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const locale    = interaction.locale;
  const discordId = interaction.user.id;
  const user      = await getUser(discordId);

  if (!user?.apiKey) {
    await interaction.editReply({ content: t(locale, "errors.not_logged_in") });
    return;
  }

  const api     = new FceApi(user.apiKey);
  const address = randomInbox();

  const result = await withApiError(interaction, locale, () => api.registerInbox(address));
  if (!result) return;

  const inbox = result.inbox;

  // Set up watch only if plan supports it
  const canWatch = hasPlan(user.plan ?? "free", "startup");
  if (canWatch) {
    const count = await countActiveWatches(discordId);
    if (count < 5) {
      const channelId = interaction.channelId;
      const guildId   = interaction.guildId ?? undefined;
      await addWatch(discordId, inbox, channelId, guildId);
      await startWatch(discordId, inbox, channelId, user.apiKey, user.locale ?? "en-US");
    }
  }

  const { embed, row } = quickstartEmbed(inbox, canWatch);
  const components     = row ? [row] : [];
  await interaction.editReply({ embeds: [embed], components });
}
