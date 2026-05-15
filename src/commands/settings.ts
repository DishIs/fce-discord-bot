import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionFlagsBits,
} from "discord.js";
import { prisma } from "../lib/store.js";
import { t } from "../i18n/index.js";

export const data = new SlashCommandBuilder()
  .setName("settings")
  .setDescription("Configure bot behaviour for yourself or this server")
  .addSubcommand((s) =>
    s.setName("output").setDescription("Toggle whether bot replies are public or dismissible")
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const sub       = interaction.options.getSubcommand();
  const locale    = interaction.locale;
  const discordId = interaction.user.id;
  const guildId   = interaction.guildId;

  if (sub === "output") {
    // In a server: require ManageMessages or Administrator
    if (guildId) {
      const member = interaction.member;
      const perms  = interaction.memberPermissions;
      const isAdmin = perms?.has(PermissionFlagsBits.Administrator) || perms?.has(PermissionFlagsBits.ManageMessages);

      if (!isAdmin) {
        await interaction.editReply({
          content: "Only server admins or moderators (Manage Messages permission) can change this setting for the server.",
        });
        return;
      }

      const guild = await prisma.guild.findUnique({ where: { guildId }, select: { publicOutput: true } });
      const current = guild?.publicOutput ?? false;

      const embed = new EmbedBuilder()
        .setColor(0x1a1a1a)
        .setTitle("Server Output Mode")
        .setDescription(
          current
            ? "**Current:** Public — bot replies appear as regular chat messages for everyone."
            : "**Current:** Private — bot replies are dismissible and only visible to the user who ran the command."
        )
        .addFields({
          name: "What this controls",
          value: "When set to Public, commands like `/messages`, `/status`, `/otp`, and others post their output as regular channel messages instead of ephemeral ones. Useful for team workflows where the output should be visible to all.",
        })
        .setFooter({ text: "freecustom.email  ·  fce bot" });

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`settings_output:guild:${current ? "0" : "1"}`)
          .setLabel(current ? "Switch to Private" : "Switch to Public")
          .setStyle(current ? ButtonStyle.Secondary : ButtonStyle.Primary),
      );

      await interaction.editReply({ embeds: [embed], components: [row] });
      return;
    }

    // In DMs: per-user setting
    const user    = await prisma.user.findUnique({ where: { discordId }, select: { publicOutput: true } });
    const current = user?.publicOutput ?? false;

    const embed = new EmbedBuilder()
      .setColor(0x1a1a1a)
      .setTitle("Output Mode")
      .setDescription(
        current
          ? "**Current:** Public — bot replies appear as regular DM messages (persistent in chat)."
          : "**Current:** Private — bot replies are dismissible (only visible temporarily)."
      )
      .addFields({
        name: "What this controls",
        value: "When set to Public, bot responses to commands like `/messages`, `/status`, `/otp`, and others are sent as regular messages that stay in your chat history instead of disappearing.",
      })
      .setFooter({ text: "freecustom.email  ·  fce bot" });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`settings_output:user:${current ? "0" : "1"}`)
        .setLabel(current ? "Switch to Private" : "Switch to Public")
        .setStyle(current ? ButtonStyle.Secondary : ButtonStyle.Primary),
    );

    await interaction.editReply({ embeds: [embed], components: [row] });
  }
}
