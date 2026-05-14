import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  MessageFlags,
} from "discord.js";
import { getUserApiKey } from "../lib/store.js";
import { FceApi } from "../lib/api.js";
import { otpEmbed } from "../lib/embed.js";
import { withApiError, requirePlan } from "../lib/upsell.js";
import { getUser } from "../lib/store.js";
import { t } from "../i18n/index.js";

export const data = new SlashCommandBuilder()
  .setName("otp")
  .setDescription("Get the latest OTP from an inbox")
  .addStringOption((o) =>
    o.setName("inbox").setDescription("Email address").setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const locale    = interaction.locale;
  const discordId = interaction.user.id;
  const user      = await getUser(discordId);

  if (!user?.apiKey) {
    await interaction.editReply({ content: t(locale, "errors.not_logged_in") });
    return;
  }

  const inbox = interaction.options.getString("inbox", true);
  const api   = new FceApi(user.apiKey);
  const data  = await withApiError(interaction, locale, () => api.getOtp(inbox));
  if (!data) return;

  if (!data.otp) {
    await interaction.editReply({ content: t(locale, "otp.none") });
    return;
  }

  await interaction.editReply({ embeds: [otpEmbed(data)] });
}
