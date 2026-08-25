import { useEffect, type ReactNode } from "react";
import { I18nextProvider } from "react-i18next";

import i18n, { readStoredLanguage, storeLanguage, type AppLanguage } from "./index";

/** Applies the persisted language after hydration and keeps <html lang> in sync. */
export function I18nProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const stored = readStoredLanguage();
    if (stored !== i18n.language) void i18n.changeLanguage(stored);

    const onChange = (lng: string) => {
      document.documentElement.lang = lng;
    };
    onChange(stored);
    i18n.on("languageChanged", onChange);
    return () => {
      i18n.off("languageChanged", onChange);
    };
  }, []);

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}

/** Changes the active language and persists it locally. */
export function setAppLanguage(language: AppLanguage) {
  storeLanguage(language);
  void i18n.changeLanguage(language);
}
