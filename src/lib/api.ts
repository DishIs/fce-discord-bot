import { normalizePlan, type PlanName } from "./plan.js";

const BASE = process.env.FCE_API_BASE ?? "https://api2.freecustom.email/v1";

export interface ApiMessage {
  id:                string;
  from:              string;
  subject:           string;
  body_text?:        string;
  body_html?:        string;
  otp?:              string;
  verification_link?: string;
  date:              string;
  timestamp?:        number;
}

export interface ApiInbox {
  inbox: string;
}

export interface ApiDomain {
  domain: string;
  tier:   string;
}

export interface ApiStatus {
  plan:            PlanName;
  plan_label:      string;
  price:           string;
  credits:         number;
  api_inbox_count: number;
  app_inbox_count: number;
}

export interface ApiUsage {
  requests_used:      number;
  requests_limit:     number;
  requests_remaining: number;
  percent_used:       string;
  credits_remaining:  number;
  resets:             string;
}

export interface ApiOtp {
  otp:               string;
  verification_link?: string;
  from:              string;
  subject:           string;
  timestamp:         number;
}

export interface ApiTimelineEvent {
  type:       string;
  latency_ms?: number;
  ts:         number;
}

export interface ApiInsight {
  type:    string;
  message: string;
}

export class FceApiError extends Error {
  constructor(public code: string, message: string, public status: number) {
    super(message);
  }
}

export class FceApi {
  constructor(private readonly apiKey: string) {}

  private async req<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "User-Agent":   "fce-discord-bot/1.0.0",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const json = await res.json() as Record<string, unknown>;

    if (!res.ok) {
      const msg  = (json.message as string) ?? `HTTP ${res.status}`;
      const code = (json.error   as string) ?? "API_ERROR";
      throw new FceApiError(code, msg, res.status);
    }

    return (json.data ?? json) as T;
  }

  getMe()                                  { return this.req<ApiStatus>("GET", "/me"); }
  getUsage()                               { return this.req<ApiUsage>("GET", "/usage"); }
  listInboxes()                            { return this.req<ApiInbox[]>("GET", "/inboxes"); }
  registerInbox(inbox: string)             { return this.req<ApiInbox>("POST", "/inboxes", { inbox }); }
  unregisterInbox(inbox: string)           { return this.req<void>("DELETE", `/inboxes/${inbox}`); }
  listMessages(inbox: string)              { return this.req<ApiMessage[]>("GET", `/inboxes/${inbox}/messages`); }
  getMessage(inbox: string, id: string)    { return this.req<ApiMessage>("GET", `/inboxes/${inbox}/messages/${id}`); }
  getOtp(inbox: string)                    { return this.req<ApiOtp>("GET", `/inboxes/${inbox}/otp`); }
  listDomains()                            { return this.req<ApiDomain[]>("GET", "/domains"); }
  getTimeline(inbox: string)               { return this.req<ApiTimelineEvent[]>("GET", `/inboxes/${inbox}/timeline`); }
  getInsights(inbox: string)               { return this.req<ApiInsight[]>("GET", `/inboxes/${inbox}/insights`); }
  getRawMe()                               { return this.req<Record<string, unknown>>("GET", "/me"); }
}

// Random inbox generator
const FALLBACK_DOMAINS = ["ditube.info", "junkstopper.info", "ditapi.info", "ditgame.info", "ditplay.info", "ditcloud.info"];
const ADJS  = ["swift","clear","quiet","bright","calm","sharp","bold","cool","crisp","light"];
const NOUNS = ["fox","hawk","mint","wave","peak","pine","vale","reef","beam","dusk"];

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

function buildAddress(domain: string): string {
  return `${pick(ADJS)}${pick(NOUNS)}${Math.floor(Math.random() * 9000) + 1000}@${domain}`;
}

// Uses the live domain list returned by api.listDomains() — already plan-filtered by the
// API, so pro/fresh/custom domains are included automatically for eligible users.
// Falls back to the hardcoded list when domains is empty or the call failed.
export function randomInboxFrom(domains: ApiDomain[]): string {
  const pool = domains.map((d) => d.domain).filter(Boolean);
  return buildAddress(pool.length ? pick(pool) : pick(FALLBACK_DOMAINS));
}

// Fallback used when we can't reach the API before registering.
export function randomInbox(): string {
  return buildAddress(pick(FALLBACK_DOMAINS));
}

export function devInbox(): string {
  const chars  = "abcdefghijklmnopqrstuvwxyz0123456789";
  const suffix = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `dev-${suffix}@${pick(FALLBACK_DOMAINS)}`;
}
