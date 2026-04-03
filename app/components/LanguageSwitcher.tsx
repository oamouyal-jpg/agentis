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
  const { locale, setLocale, t } = useI18n();

  return (
    <div
      className="flex flex-wrap items-center gap-1"
      role="group"
      aria-label={t("header.language")}
    >
      {locales.map((loc) => (
        <button
          key={loc}
          type="button"
          onClick={() => setLocale(loc)}
          className={`rounded px-2 py-1 font-mono text-[10px] font-medium uppercase tracking-wide transition ${
            locale === loc
              ? "bg-zinc-100 text-zinc-950"
              : "text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
          }`}
          title={localeLabels[loc]}
        >
          {short[loc]}
        </button>
      ))}
    </div>
  );
}
