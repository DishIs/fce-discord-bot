export type PlanName = "free" | "developer" | "startup" | "growth" | "enterprise";

export const PLAN_LEVEL: Record<PlanName, number> = {
  free:       0,
  developer:  1,
  startup:    2,
  growth:     3,
  enterprise: 4,
};

export const PLAN_LABEL: Record<PlanName, string> = {
  free:       "Free",
  developer:  "Developer",
  startup:    "Startup",
  growth:     "Growth",
  enterprise: "Enterprise",
};

export const PLAN_PRICE: Record<PlanName, string> = {
  free:       "$0",
  developer:  "$10/mo",
  startup:    "$29/mo",
  growth:     "$89/mo",
  enterprise: "$199/mo",
};

export const PLAN_FEATURES: Record<PlanName, string[]> = {
  free:       ["1 req/sec", "1,000 req/month", "10 inboxes", "Shared pool", "10h retention"],
  developer:  ["10 req/sec", "50,000 req/month", "25 inboxes", "Dedicated pool", "Wait API", "OTP extraction"],
  startup:    ["25 req/sec", "250,000 req/month", "40 inboxes", "Dedicated pool", "WebSocket watch", "OTP extraction", "Attachments up to 5 MB"],
  growth:     ["50 req/sec", "1,000,000 req/month", "100 inboxes", "Dedicated pool", "WebSocket watch", "OTP extraction", "Attachments up to 25 MB", "Custom domains", "MCP access", "Webhooks", "Timeline & insights"],
  enterprise: ["100 req/sec", "10,000,000 req/month", "Unlimited inboxes", "Dedicated pool", "Everything in Growth", "99.5% SLA", "Dedicated support"],
};

export function planLevel(plan: string): number {
  return PLAN_LEVEL[plan as PlanName] ?? 0;
}

export function hasPlan(userPlan: string, required: PlanName): boolean {
  return planLevel(userPlan) >= PLAN_LEVEL[required];
}

export function normalizePlan(raw: unknown): PlanName {
  if (typeof raw === "string" && raw in PLAN_LEVEL) return raw as PlanName;
  return "free";
}

export function planBadge(plan: string): string {
  const badges: Record<string, string> = {
    free:       "FREE",
    developer:  "DEV",
    startup:    "STARTUP",
    growth:     "GROWTH",
    enterprise: "ENTERPRISE",
  };
  return badges[plan] ?? "FREE";
}
