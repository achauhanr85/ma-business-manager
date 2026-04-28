/**
 * UserPreferencesContext.tsx — Stores and loads the user's language, theme,
 * date format, and default receipt language preferences.
 *
 * WHAT THIS FILE DOES:
 * On first render after login, this context fetches preferences from the backend
 * (`getUserPreferences()`). It applies the saved theme immediately via `applyTheme()`
 * so the correct CSS variables are active before the first paint — preventing the
 * flash of the wrong theme or language (BUG-15 fix).
 *
 * IMPORTANT DESIGN DECISION — `isLoading` gate:
 * The context exposes `isLoading: true` until the preferences fetch completes.
 * `AuthenticatedApp` (in App.tsx) checks this flag and shows a loading spinner
 * instead of rendering any app content. This is what prevents the "flash of English"
 * on first load for Hindi or Gujarati users.
 *
 * HOW SAVING WORKS:
 * Changes to language, theme, date format do NOT auto-save. They update local
 * state only. The user must click the Save button on the Preferences page, which
 * calls `saveAllPreferences()`. This is intentional — the spec says no auto-save.
 *
 * WHO USES THIS:
 *   translations/index.ts — reads `language` via `useTranslation()` hook
 *   UserPreferencesPage.tsx — reads and writes all preferences
 *   ReceiptPage.tsx — reads `defaultReceiptLanguage` and `formatDate`
 *   Layout.tsx and various pages — call `formatDate()` to display dates
 *   App.tsx / AuthenticatedApp — reads `isLoading` for the render gate
 */

import { createActor } from "@/backend";
import { applyTheme } from "@/lib/color";
import { useActor } from "@caffeineai/core-infrastructure";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type React from "react";

/** The three supported UI languages */
type Language = "en" | "gu" | "hi";

/** The four available UI themes — each maps to a theme-[name] CSS class */
export type ThemeName = "herbal" | "dark" | "minimalist" | "punk";

/** Available date format options — shown in the Preferences form */
const DATE_FORMAT_OPTIONS = [
  "DD/MM/YYYY",
  "MM/DD/YYYY",
  "YYYY-MM-DD",
  "DD-MMM-YYYY",
] as const;

export type DateFormat = (typeof DATE_FORMAT_OPTIONS)[number];

/** Fall back to "dark" if no saved theme exists */
const DEFAULT_THEME: ThemeName = "dark";

/** Everything exposed by the context */
interface UserPreferencesContextValue {
  /** Currently active UI language — drives all translation lookups */
  language: Language;
  /** Currently active theme name — drives CSS class on <html> */
  theme: ThemeName;
  /** Currently active date format string */
  dateFormat: DateFormat;
  /** Language to use when generating PDFs (can differ from UI language) */
  defaultReceiptLanguage: Language;
  /** Change language in local state only — does NOT save to backend yet */
  updateLanguage: (lang: Language) => void;
  /** Change theme in local state only — previews immediately but does NOT save */
  updateTheme: (theme: ThemeName) => void;
  /** Change date format in local state only */
  updateDateFormat: (fmt: DateFormat) => void;
  /** Change receipt language in local state only */
  updateDefaultReceiptLanguage: (lang: Language) => void;
  /** Save ALL current preference values to the backend in one call */
  saveAllPreferences: () => Promise<boolean>;
  /** Convert any date value to a string using the currently active date format */
  formatDate: (dateInput: Date | bigint | number | string) => string;
  /** true while preferences are being fetched — AuthenticatedApp blocks render until false */
  isLoading: boolean;
}

// Create the context with safe defaults for components rendered outside the provider
// (e.g. in tests or the public index page)
export const UserPreferencesContext =
  createContext<UserPreferencesContextValue>({
    language: "en",
    theme: DEFAULT_THEME,
    dateFormat: "DD/MM/YYYY",
    defaultReceiptLanguage: "en",
    updateLanguage: () => {},
    updateTheme: () => {},
    updateDateFormat: () => {},
    updateDefaultReceiptLanguage: () => {},
    saveAllPreferences: async () => false,
    formatDate: (d) => String(d),
    isLoading: false, // outside provider — treat as loaded
  });

/**
 * applyDateFormat — converts any date-like value to a formatted string.
 * Handles four input types:
 *   - Date object
 *   - bigint (nanoseconds from IC backend — divided by 1_000_000 to get milliseconds)
 *   - number (milliseconds timestamp)
 *   - string (parsed via Date constructor)
 */
function applyDateFormat(
  dateInput: Date | bigint | number | string,
  format: DateFormat,
): string {
  let d: Date;
  if (dateInput instanceof Date) {
    d = dateInput;
  } else if (typeof dateInput === "bigint") {
    // IC timestamps are in nanoseconds — convert to ms for the Date constructor
    d = new Date(Number(dateInput / BigInt(1_000_000)));
  } else if (typeof dateInput === "number") {
    d = new Date(dateInput);
  } else {
    d = new Date(dateInput);
  }

  // Guard: if the date is invalid, return the raw input as a string fallback
  if (Number.isNaN(d.getTime())) return String(dateInput);

  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  const monthShort = d.toLocaleString("en", { month: "short" });

  switch (format) {
    case "DD/MM/YYYY":
      return `${day}/${month}/${year}`;
    case "MM/DD/YYYY":
      return `${month}/${day}/${year}`;
    case "YYYY-MM-DD":
      return `${year}-${month}-${day}`;
    case "DD-MMM-YYYY":
      return `${day}-${monthShort}-${year}`;
    default:
      return `${day}/${month}/${year}`;
  }
}

/** Type guard — returns true if the given string is a valid ThemeName */
function isValidTheme(t: string): t is ThemeName {
  return ["herbal", "dark", "minimalist", "punk"].includes(t);
}

/**
 * UserPreferencesProvider — wraps the authenticated app to make preferences
 * available everywhere.
 *
 * BUG-15 FIX: Language AND theme are fetched from the backend BEFORE the app
 * renders. `isPrefsLoading` starts as `true` and is set to `false` only after
 * the fetch resolves (success or error). `AuthenticatedApp` in App.tsx reads the
 * exposed `isLoading` and shows a spinner instead of app content until it's false.
 *
 * This means the first paint always uses the correct language and theme — there
 * is no brief flash of English labels or the wrong background colour.
 */
export function UserPreferencesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { actor, isFetching: actorFetching } = useActor(createActor);

  // ── Local preference state (mirrors backend values after load) ─────────────
  const [language, setLanguage] = useState<Language>("en");
  const [theme, setTheme] = useState<ThemeName>(DEFAULT_THEME);
  const [dateFormat, setDateFormat] = useState<DateFormat>("DD/MM/YYYY");
  const [defaultReceiptLanguage, setDefaultReceiptLanguage] =
    useState<Language>("en");

  // `isPrefsLoading` — true until the backend preference fetch completes.
  // App.tsx reads this via `isLoading` to block rendering (BUG-15 fix).
  const [isPrefsLoading, setIsPrefsLoading] = useState(true);

  // Guard against calling the fetch twice (React Strict Mode fires effects twice in dev)
  const fetchAttempted = useRef(false);

  // ── Fetch preferences from backend BEFORE first render ────────────────────
  // This effect runs once: when the actor is ready and no fetch has been attempted.
  useEffect(() => {
    if (fetchAttempted.current || actorFetching || !actor) return;
    fetchAttempted.current = true;

    (async () => {
      try {
        // Fetch all saved user preferences from the backend in one call
        const prefs = await actor.getUserPreferences();

        // Extract each value with fallbacks in case the backend returns null/undefined
        const lang = (prefs?.language as Language) || "en";
        const fmt = (prefs?.dateFormat as DateFormat) || "DD/MM/YYYY";
        const rcptLang = (prefs?.defaultReceiptLanguage as Language) || "en";
        const rawTheme = (prefs?.theme as string) || DEFAULT_THEME;
        const resolvedTheme = isValidTheme(rawTheme) ? rawTheme : DEFAULT_THEME;

        // Update all state values in one batch
        setLanguage(lang);
        setDateFormat(fmt);
        setDefaultReceiptLanguage(rcptLang);
        setTheme(resolvedTheme);

        // Apply theme class immediately — this changes the CSS custom properties
        // so the very first paint uses the correct colours, not the defaults
        applyTheme(resolvedTheme);

        // Persist to localStorage for non-React consumers (e.g. the `t()` helper in
        // translations/index.ts which needs the language outside the React tree)
        localStorage.setItem("inl_language", lang);
        localStorage.setItem("inl_theme", resolvedTheme);
      } catch {
        // Even on failure, apply the default theme so the UI is at least styled
        applyTheme(DEFAULT_THEME);
      } finally {
        // Unblock rendering — even if the fetch failed, we use defaults
        setIsPrefsLoading(false);
      }
    })();
  }, [actor, actorFetching]);

  // ── Local-only update functions (no backend call) ─────────────────────────
  // These update local state immediately so the UI reacts to changes in real time.
  // The actual save to the backend happens only when the user clicks Save.

  /** Update the UI language in local state. No backend call yet. */
  const updateLanguage = useCallback((lang: Language) => {
    setLanguage(lang);
  }, []);

  /**
   * Update the theme in local state AND apply it to the DOM immediately.
   * The preview is instant — saves only when the user clicks Save.
   * Also saves to localStorage so non-React code sees it right away.
   */
  const updateTheme = useCallback((t: ThemeName) => {
    setTheme(t);
    applyTheme(t); // apply immediately for visual preview
    localStorage.setItem("inl_theme", t);
  }, []);

  /** Update date format in local state. No backend call yet. */
  const updateDateFormat = useCallback((fmt: DateFormat) => {
    setDateFormat(fmt);
  }, []);

  /** Update default receipt language in local state. No backend call yet. */
  const updateDefaultReceiptLanguage = useCallback((lang: Language) => {
    setDefaultReceiptLanguage(lang);
  }, []);

  // ── Save all preferences to backend ───────────────────────────────────────
  /**
   * saveAllPreferences — writes all current preference values to the backend
   * in a single `updateUserPreferences()` call. Returns true on success.
   *
   * Called only when the user explicitly clicks the Save button on the
   * Preferences page — never called automatically.
   */
  const saveAllPreferences = useCallback(async (): Promise<boolean> => {
    if (!actor) return false;
    try {
      const ok = await actor.updateUserPreferences(
        language,
        dateFormat,
        defaultReceiptLanguage,
        "", // whatsappNumber — managed separately, not from this form
        theme, // theme is stored as a plain text field in the backend
      );
      if (ok) {
        // Keep localStorage in sync after a successful save
        localStorage.setItem("inl_language", language);
        localStorage.setItem("inl_theme", theme);
        applyTheme(theme);
      }
      return ok;
    } catch {
      return false;
    }
  }, [actor, language, dateFormat, defaultReceiptLanguage, theme]);

  /**
   * formatDate — converts any date-like value to a display string using
   * the currently active date format. Passed to children via context so
   * they don't need to import the format themselves.
   */
  const formatDate = useCallback(
    (dateInput: Date | bigint | number | string) =>
      applyDateFormat(dateInput, dateFormat),
    [dateFormat],
  );

  return (
    <UserPreferencesContext.Provider
      value={{
        language,
        theme,
        dateFormat,
        defaultReceiptLanguage,
        updateLanguage,
        updateTheme,
        updateDateFormat,
        updateDefaultReceiptLanguage,
        saveAllPreferences,
        formatDate,
        // Expose `isPrefsLoading` as `isLoading` — the public API name
        isLoading: isPrefsLoading,
      }}
    >
      {children}
    </UserPreferencesContext.Provider>
  );
}

/**
 * useUserPreferences — hook for accessing preferences in any component.
 * Returns the full context value: current values + update functions.
 */
export function useUserPreferences(): UserPreferencesContextValue {
  return useContext(UserPreferencesContext);
}

export { DATE_FORMAT_OPTIONS };
