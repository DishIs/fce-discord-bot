import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  MessageFlags,
} from "discord.js";
import { getUserApiKey } from "../lib/store.js";
import { FceApi } from "../lib/api.js";
import { messageEmbed } from "../lib/embed.js";
import { withApiError } from "../lib/upsell.js";
import { t } from "../i18n/index.js";
import { isOutputEphemeral, createViewToken } from "../lib/reply-mode.js";

const CALLBACK_BASE = process.env.CALLBACK_BASE_URL ?? "http://localhost:4242";

export const data = new SlashCommandBuilder()
  .setName("read")
  .setDescription("Open a specific email message")
  .addStringOption((o) =>
    o.setName("inbox").setDescription("Email address").setRequired(true)
  )
  .addStringOption((o) =>
    o.setName("id").setDescription("Message ID").setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const locale    = interaction.locale;
  const discordId = interaction.user.id;
  const ephemeral = await isOutputEphemeral(discordId, interaction.guildId);
  await interaction.deferReply(ephemeral ? { flags: MessageFlags.Ephemeral } : {});
  const apiKey    = await getUserApiKey(discordId);

  if (!apiKey) {
    await interaction.editReply({ content: t(locale, "errors.not_logged_in") });
    return;
  }

  const inbox = interaction.options.getString("inbox", true);
  const id    = interaction.options.getString("id", true);
  const api   = new FceApi(apiKey);
  const msg   = await withApiError(interaction, locale, () => api.getMessage(inbox, id), { inbox });
  if (!msg) return;

  const token  = await createViewToken({ inbox, messageId: id, apiKey });
  const viewUrl = `${CALLBACK_BASE}/view/${token}`;

  const { embed, row } = messageEmbed(msg, viewUrl);
  await interaction.editReply({ embeds: [embed], components: row ? [row] : [] });
}
