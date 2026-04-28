/**
 * translations/index.ts — Translation lookup and React hook for multi-lingual UI.
 *
 * WHAT THIS FILE DOES:
 * This file ties the three translation bundles (English, Gujarati, Hindi) to the
 * user's language preference. It exports:
 *
 *   1. `useTranslation()` — a React hook that returns the correct translation object
 *      based on the language stored in `UserPreferencesContext`. Call this inside
 *      any React component that displays text.
 *
 *   2. `getTranslations(language)` — a plain function (no hook) that returns the
 *      translation object for a given language. Useful in utility functions and
 *      tests that run outside the React component tree.
 *
 *   3. `t(language?)` — a shorthand plain function that reads the language from
 *      localStorage (set by `UserPreferencesContext` when prefs are saved).
 *      Used by non-React code (e.g. PDF generation helpers).
 *
 * HOW IT WORKS:
 * `useTranslation()` reads `ctx.language` from `UserPreferencesContext`, which is
 * set when preferences load from the backend. This means the language is always
 * correct from the very first render — no flash of English.
 *
 * WHO USES THIS:
 *   Every page and component that displays user-visible text
 */

import { useContext } from "react";
import { UserPreferencesContext } from "../contexts/UserPreferencesContext";
import { en } from "./en";
import { gu } from "./gu";
import { hi } from "./hi";

// Re-export types and translation bundles so importers can access them
export type { TranslationKeys } from "./en";
export { en } from "./en";
export { gu } from "./gu";
export { hi } from "./hi";

/** The three supported UI languages */
type Language = "en" | "gu" | "hi";

/** Map of language code → translation bundle */
const translations = { en, gu, hi } as const;

/**
 * getTranslations — returns the full translation object for a given language.
 * Falls back to English if the language code is not recognised.
 *
 * Use this in utility functions or test code that runs outside the React tree.
 * Inside React components, use `useTranslation()` instead.
 *
 * @param language - "en" | "gu" | "hi"
 * @returns The translation bundle for that language
 */
export function getTranslations(language: Language) {
  return translations[language] ?? translations.en;
}

/**
 * useTranslation — React hook that returns the correct translation object
 * based on the user's saved language preference.
 *
 * Usage:
 *   const t = useTranslation();
 *   return <h1>{t.nav.dashboard}</h1>
 *
 * The language is sourced from `UserPreferencesContext.language`, which is
 * loaded from the backend before the first render (BUG-15 fix). This means
 * the translated text is correct on the very first paint — no English flash.
 */
export function useTranslation() {
  // Read the language from the context — defaults to "en" if context is not available
  const ctx = useContext(UserPreferencesContext);
  const lang = (ctx?.language ?? "en") as Language;
  return getTranslations(lang);
}

/**
 * t — non-hook translation accessor for use outside the React component tree.
 * Reads the language from `localStorage` (set by `UserPreferencesContext` when
 * preferences are saved). Falls back to English if localStorage is empty.
 *
 * Usage (outside React):
 *   const translations = t();
 *   const translated = t("gu").nav.dashboard;
 *
 * @param language - Optional explicit language override. If not provided,
 *                   reads from `localStorage.getItem("inl_language")`.
 */
export function t(language?: Language) {
  const lang: Language =
    language ?? (localStorage.getItem("inl_language") as Language) ?? "en";
  return getTranslations(lang);
}
