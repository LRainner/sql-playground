import messages from "../locales/translations.json";

export type Locale = "cn" | "en";
export type TranslationKey = keyof typeof messages;
export type TranslationParams = Record<string, string | number>;
export type Translate = (key: TranslationKey, params?: TranslationParams) => string;

export function getInitialLocale(): Locale {
  if (typeof window === "undefined") return "en";
  const saved = window.localStorage.getItem("sql-playground-locale");
  if (saved === "cn" || saved === "en") return saved;
  return window.navigator.language.toLowerCase().startsWith("zh") ? "cn" : "en";
}

export function createTranslator(locale: Locale): Translate {
  return (key, params = {}) => {
    const message = messages[key][locale] ?? messages[key].en;
    return message.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`));
  };
}
