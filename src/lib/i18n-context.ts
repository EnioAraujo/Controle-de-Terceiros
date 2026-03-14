import { createContext } from "react";
import { translations, type Lang, type TranslationKey } from "./i18n-translations";

export type { Lang, TranslationKey };

export interface I18nContext {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: TranslationKey) => string;
}

export const Ctx = createContext<I18nContext>({
  lang: "pt-BR",
  setLang: () => {},
  t: (k) => translations["pt-BR"][k],
});
