import { ChatInputCommandInteraction, MessageFlags } from "discord.js";
import { planGateEmbed, rateLimitEmbed } from "./embed.js";
import { hasPlan, type PlanName } from "./plan.js";
import { FceApiError } from "./api.js";
import { t } from "../i18n/index.js";

const PRICING_BASE =
  process.env.FCE_PRICING_URL ?? "https://www.freecustom.email/api/pricing";

export function planGateUrl(plan: PlanName): string {
  return `${PRICING_BASE}?plan=${plan}&utm_source=discord_gate&utm_medium=bot`;
}

export function upgradeUrl(plan: PlanName): string {
  return `${PRICING_BASE}?plan=${plan}&utm_source=discord_upgrade&utm_medium=bot`;
}

// Call at the top of any plan-gated command. Returns false and replies if blocked.
export async function requirePlan(
  interaction: ChatInputCommandInteraction,
  userPlan:    string,
  required:    PlanName,
  feature:     string,
  locale:      string
): Promise<boolean> {
  if (hasPlan(userPlan, required)) return true;

  const { embed, row } = planGateEmbed(required, feature, userPlan);
  await interaction.editReply({ embeds: [embed], components: [row] });
  return false;
}

// Wraps an API call, catches FceApiError, replies with appropriate embed.
// Returns the data on success or null on handled error.
export async function withApiError<T>(
  interaction: ChatInputCommandInteraction,
  locale:      string,
  fn:          () => Promise<T>
): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof FceApiError) {
      if (err.status === 429) {
        // Parse rate limit info from the error message if present
        const { embed, row } = rateLimitEmbed(0, 0, 0, "—");
        const components = row ? [row] : [];
        await interaction.editReply({ embeds: [embed], components });
        return null;
      }

      if (err.status === 402) {
        await interaction.editReply({
          content: t(locale, "errors.rate_limit", { usage: err.message }),
        });
        return null;
      }

      await interaction.editReply({
        content: t(locale, "errors.api_error", { message: err.message }),
      });
      return null;
    }

    console.error("[api]", err);
    await interaction.editReply({ content: t(locale, "errors.unknown") });
    return null;
  }
}
