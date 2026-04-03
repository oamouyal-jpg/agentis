export const locales = ["en", "he", "es", "fr", "ar", "ja", "zh"] as const;
export type AppLocale = (typeof locales)[number];

export const localeLabels: Record<AppLocale, string> = {
  en: "English",
  he: "עברית",
  es: "Español",
  fr: "Français",
  ar: "العربية",
  ja: "日本語",
  zh: "中文",
};

export const rtlLocales = new Set<AppLocale>(["he", "ar"]);

export function isRtl(locale: AppLocale): boolean {
  return rtlLocales.has(locale);
}

export function parseAcceptLanguage(header: string | null): AppLocale | null {
  if (!header) return null;
  const first = header.split(",")[0]?.trim().split("-")[0]?.toLowerCase();
  if (first === "ar") return "ar";
  if (first === "he") return "he";
  if (first === "fr") return "fr";
  if (first === "ja") return "ja";
  if (first === "zh") return "zh";
  if (first === "es") return "es";
  if (first === "en") return "en";
  return null;
}
