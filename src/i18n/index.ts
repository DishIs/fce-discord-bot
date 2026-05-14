import en from "./en.json";

// Supported locale → translation file map
// Add new locales by creating e.g. src/i18n/de.json and importing here
const TRANSLATIONS: Record<string, typeof en> = {
  "en-US": en,
  "en-GB": en,
};

// All unsupported locales fall back to English
export function t(
  locale: string,
  key: string,
  vars: Record<string, string | number> = {}
): string {
  const dict = TRANSLATIONS[locale] ?? en;

  // dot-path lookup: "errors.not_logged_in" → dict.errors.not_logged_in
  const value = key.split(".").reduce<unknown>((obj, k) => {
    if (obj && typeof obj === "object") return (obj as Record<string, unknown>)[k];
    return undefined;
  }, dict);

  let str = typeof value === "string" ? value : key;

  // Replace {var} placeholders
  for (const [k, v] of Object.entries(vars)) {
    str = str.replaceAll(`{${k}}`, String(v));
  }

  return str;
}

export const SUPPORTED_LOCALES = Object.keys(TRANSLATIONS);

// Discord slash command localizations — name + description per locale
// Used in deploy-commands.ts for the top-level commands
export const COMMAND_LOCALIZATIONS: Record<
  string,
  { name?: string; description?: string }
> = {
  // extend as more locale files are added
};
