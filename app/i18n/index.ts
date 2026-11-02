// One i18next instance for the page. The language is a setting (see lib/settings.ts), not part of the address, so it can change at any time.
import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import type { Lang } from "~/lib/storage";
import en from "./en";
import id from "./id";

export const i18n = i18next.createInstance();
i18n.use(initReactI18next).init({
  lng: "en",
  fallbackLng: "en",
  resources: { en: { translation: en }, id: { translation: id } },
  initAsync: false,
  interpolation: { escapeValue: false }, // React escapes
  returnNull: false,
});

export const setI18nLanguage = (lang: Lang): void => void i18n.changeLanguage(lang);
