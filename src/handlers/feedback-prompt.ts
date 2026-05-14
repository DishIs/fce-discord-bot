import { Client, MessageFlags } from "discord.js";
import { getUser, markFeedbackSent } from "../lib/store.js";
import { feedbackPromptEmbed } from "../lib/embed.js";

const TRIGGER_COUNT = parseInt(process.env.FEEDBACK_TRIGGER_COUNT ?? "15", 10);

// Called after every successful command. Sends a DM rating prompt at threshold.
export async function maybeSendFeedbackPrompt(
  client:      Client,
  discordId:   string,
  commandCount: number
): Promise<void> {
  if (commandCount !== TRIGGER_COUNT) return;

  try {
    const user = await getUser(discordId);
    if (!user || user.feedbackSent) return;

    const dmUser             = await client.users.fetch(discordId);
    const { embed, row }     = feedbackPromptEmbed();
    await dmUser.send({ embeds: [embed], components: [row] });
  } catch {
    // DMs blocked or user not found — skip silently
  }
}
