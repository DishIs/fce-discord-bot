import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { getUserApiKey } from "../lib/store.js";
import { FceApi, randomInbox } from "../lib/api.js";
import { inboxListEmbed } from "../lib/embed.js";
import { withApiError } from "../lib/upsell.js";
import { t } from "../i18n/index.js";

export const data = new SlashCommandBuilder()
  .setName("inbox")
  .setDescription("Manage your email inboxes")
  .addSubcommand((sub) =>
    sub.setName("list").setDescription("List all registered inboxes")
  )
  .addSubcommand((sub) =>
    sub
      .setName("add")
      .setDescription("Register a new inbox")
      .addStringOption((o) =>
        o
          .setName("address")
          .setDescription("Email address (leave blank to generate one)")
          .setRequired(false)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("remove")
      .setDescription("Unregister an inbox")
      .addStringOption((o) =>
        o.setName("address").setDescription("Email address to remove").setRequired(true)
      )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const locale    = interaction.locale;
  const discordId = interaction.user.id;
  const apiKey    = await getUserApiKey(discordId);

  if (!apiKey) {
    await interaction.editReply({ content: t(locale, "errors.not_logged_in") });
    return;
  }

  const api = new FceApi(apiKey);
  const sub = interaction.options.getSubcommand();

  if (sub === "list") {
    const inboxes = await withApiError(interaction, locale, () => api.listInboxes());
    if (!inboxes) return;
    const { embed, row } = inboxListEmbed(inboxes);
    await interaction.editReply({ embeds: [embed], components: row ? [row] : [] });
    return;
  }

  if (sub === "add") {
    const address = interaction.options.getString("address") ?? randomInbox();
    const result  = await withApiError(interaction, locale, () => api.registerInbox(address));
    if (!result) return;
    await interaction.editReply({
      content: `${t(locale, "inbox.added")}: \`${result.inbox}\``,
    });
    return;
  }

  if (sub === "remove") {
    const address = interaction.options.getString("address", true);

    // Confirmation buttons
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`inbox_remove_confirm:${address}`)
        .setLabel(t(locale, "inbox.confirm_yes"))
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId("inbox_remove_cancel")
        .setLabel(t(locale, "inbox.confirm_no"))
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.editReply({
      content: t(locale, "inbox.confirm_remove", { inbox: address }),
      components: [row],
    });
  }
}
