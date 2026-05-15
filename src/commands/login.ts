import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  MessageFlags,
} from "discord.js";
import { getUser, createLoginState } from "../lib/store.js";
import { loginEmbed } from "../lib/embed.js";
import { t } from "../i18n/index.js";

export const data = new SlashCommandBuilder()
  .setName("login")
  .setDescription("Connect your FreeCustom.Email API account");

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const locale     = interaction.locale;
  const discordId  = interaction.user.id;
  const existing   = await getUser(discordId);

  if (existing?.apiKey) {
    await interaction.editReply({
      content: `${t(locale, "login.already")}\n${t(locale, "login.already_hint")}`,
    });
    return;
  }

  const state      = await createLoginState(discordId, interaction.channelId);
  const authBase   = process.env.FCE_CLI_AUTH_URL ?? "https://www.freecustom.email/api/cli-auth";
  const callbackBase = process.env.CALLBACK_BASE_URL ?? "https://bot.freecustom.email";
  // state is embedded inside the callback URL so the auth page forwards it automatically
  const callbackUrl = `${callbackBase}/auth/callback?state=${state}`;
  const authUrl     = `${authBase}?callback=${encodeURIComponent(callbackUrl)}&source=discord`;

  const { embed, row } = loginEmbed(authUrl);
  await interaction.editReply({ embeds: [embed], components: [row] });
}
