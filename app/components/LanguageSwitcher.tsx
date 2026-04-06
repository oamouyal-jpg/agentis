"use client";

import { useI18n } from "../../lib/i18n/I18nProvider";
import { localeLabels, locales, type AppLocale } from "../../lib/i18n/config";

const short: Record<AppLocale, string> = {
  en: "EN",
  he: "עב",
  es: "ES",
  fr: "FR",
  ar: "عر",
  ja: "日",
  zh: "中",
};

export function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();

  return (
    <select
      value={locale}
      onChange={(e) => setLocale(e.target.value as AppLocale)}
      className="w-14 rounded-md border border-zinc-700 bg-zinc-900 px-1 py-1 text-center font-mono text-[11px] font-medium text-zinc-400 outline-none transition hover:border-zinc-600 hover:text-zinc-100 sm:w-auto sm:px-2 sm:py-1.5 sm:text-left sm:text-xs"
      aria-label="Language"
    >
      {locales.map((loc) => (
        <option key={loc} value={loc}>
          {short[loc]} — {localeLabels[loc]}
        </option>
      ))}
    </select>
  );
}
