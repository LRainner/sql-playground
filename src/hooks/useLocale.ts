import { useCallback, useEffect, useMemo, useState } from "react";
import { createTranslator, getInitialLocale, type Locale } from "../lib/i18n";

export function useLocale() {
  const [locale, setLocale] = useState<Locale>(getInitialLocale);
  const t = useMemo(() => createTranslator(locale), [locale]);
  const toggleLocale = useCallback(
    () => setLocale((current) => (current === "cn" ? "en" : "cn")),
    [],
  );

  useEffect(() => {
    window.localStorage.setItem("sql-playground-locale", locale);
    document.documentElement.lang = locale === "cn" ? "zh-CN" : "en";
  }, [locale]);

  return { locale, t, toggleLocale };
}
