import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  MessageFlags,
} from "discord.js";
import { getUser, setJsonMode } from "../lib/store.js";
import { t } from "../i18n/index.js";

export const data = new SlashCommandBuilder()
  .setName("format")
  .setDescription("Toggle JSON output mode for API responses")
  .addBooleanOption((o) =>
    o.setName("json").setDescription("Enable JSON mode").setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const locale    = interaction.locale;
  const discordId = interaction.user.id;
  const user      = await getUser(discordId);

  if (!user) {
    await interaction.editReply({ content: t(locale, "errors.not_logged_in") });
    return;
  }

  const on = interaction.options.getBoolean("json", true);
  await setJsonMode(discordId, on);
  await interaction.editReply({
    content: on ? "JSON mode **enabled**." : "JSON mode **disabled**.",
  });
}
