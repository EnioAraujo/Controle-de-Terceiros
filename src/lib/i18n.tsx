import { useState, useEffect, ReactNode } from "react";
import { translations, type Lang } from "./i18n-translations";
import { Ctx, type TranslationKey } from "./i18n-context";

export type { Lang, TranslationKey };

const STORAGE_KEY = "app_lang";

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "en-US" ? "en-US" : "pt-BR";
  });

  const setLang = (l: Lang) => {
    localStorage.setItem(STORAGE_KEY, l);
    setLangState(l);
  };

  // Atualiza o atributo lang do documento quando o idioma muda
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const t = (key: TranslationKey): string => translations[lang][key];

  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
}
