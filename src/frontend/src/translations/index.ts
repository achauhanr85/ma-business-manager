import { useContext } from "react";
import { UserPreferencesContext } from "../contexts/UserPreferencesContext";
import { en } from "./en";
import { gu } from "./gu";
import { hi } from "./hi";

export type { TranslationKeys } from "./en";
export { en } from "./en";
export { gu } from "./gu";
export { hi } from "./hi";

type Language = "en" | "gu" | "hi";

const translations = { en, gu, hi } as const;

/**
 * Returns the translation object for a given language.
 * Falls back to English if the language is not supported.
 */
export function getTranslations(language: Language) {
  return translations[language] ?? translations.en;
}

/**
 * React hook for accessing translations in components.
 * Reads language from UserPreferencesContext.
 */
export function useTranslation() {
  const ctx = useContext(UserPreferencesContext);
  const lang = (ctx?.language ?? "en") as Language;
  return getTranslations(lang);
}

/**
 * Non-hook translation accessor for use outside React tree.
 * Reads language from localStorage if available.
 */
export function t(language?: Language) {
  const lang: Language =
    language ?? (localStorage.getItem("inl_language") as Language) ?? "en";
  return getTranslations(lang);
}
