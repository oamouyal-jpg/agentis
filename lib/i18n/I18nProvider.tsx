"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AppLocale } from "./config";
import { isRtl, locales } from "./config";
import { messagesByLocale, type MessageTree } from "./messages";

const STORAGE_KEY = "agentis-locale";

type I18nContextValue = {
  locale: AppLocale;
  setLocale: (next: AppLocale) => void;
  t: (key: string, vars?: Record<string, string>) => string;
  dir: "ltr" | "rtl";
};

const I18nContext = createContext<I18nContextValue | null>(null);

function getNested(obj: MessageTree | undefined, path: string): unknown {
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur && typeof cur === "object" && p in (cur as object)) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return undefined;
    }
  }
  return cur;
}

function applyVars(template: string, vars?: Record<string, string>): string {
  if (!vars) return template;
  let s = template;
  for (const [k, v] of Object.entries(vars)) {
    s = s.split(`{{${k}}}`).join(v);
  }
  return s;
}

function readStoredLocale(): AppLocale | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw && (locales as readonly string[]).includes(raw)) {
      return raw as AppLocale;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function browserLocale(): AppLocale {
  if (typeof navigator === "undefined") return "en";
  const lang = navigator.language?.slice(0, 2).toLowerCase();
  if (lang === "ar") return "ar";
  if (lang === "fr") return "fr";
  if (lang === "he") return "he";
  if (lang === "ja") return "ja";
  if (lang === "zh") return "zh";
  if (lang === "es") return "es";
  return "en";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<AppLocale>("en");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = readStoredLocale();
    setLocaleState(stored ?? browserLocale());
    setReady(true);
  }, []);

  const setLocale = useCallback((next: AppLocale) => {
    setLocaleState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    const el = document.documentElement;
    el.lang = locale;
    const rtl = isRtl(locale);
    el.dir = rtl ? "rtl" : "ltr";
    el.classList.toggle("rtl", rtl);
  }, [locale, ready]);

  const t = useCallback(
    (key: string, vars?: Record<string, string>) => {
      const tree = messagesByLocale[locale] ?? messagesByLocale.en;
      let raw = getNested(tree, key);
      if (raw === undefined && locale !== "en") {
        raw = getNested(messagesByLocale.en, key);
      }
      if (typeof raw === "string") {
        return applyVars(raw, vars);
      }
      return key;
    },
    [locale]
  );

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      t,
      dir: isRtl(locale) ? "rtl" : "ltr",
    }),
    [locale, setLocale, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return ctx;
}

/** Safe hook for components that may render outside provider (returns English). */
export function useI18nOptional(): I18nContextValue | null {
  return useContext(I18nContext);
}
