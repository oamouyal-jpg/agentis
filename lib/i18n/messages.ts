import type { AppLocale } from "./config";

export type MessageTree = Record<string, string | string[] | MessageTree>;

import en from "../../messages/en.json";
import fr from "../../messages/fr.json";
import es from "../../messages/es.json";
import he from "../../messages/he.json";
import ar from "../../messages/ar.json";
import ja from "../../messages/ja.json";
import zh from "../../messages/zh.json";

export const messagesByLocale: Record<AppLocale, MessageTree> = {
  en: en as MessageTree,
  he: he as MessageTree,
  es: es as MessageTree,
  fr: fr as MessageTree,
  ar: ar as MessageTree,
  ja: ja as MessageTree,
  zh: zh as MessageTree,
};
