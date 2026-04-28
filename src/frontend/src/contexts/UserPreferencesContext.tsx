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

type Language = "en" | "gu" | "hi";
export type ThemeName = "herbal" | "dark" | "minimalist" | "punk";

const DATE_FORMAT_OPTIONS = [
  "DD/MM/YYYY",
  "MM/DD/YYYY",
  "YYYY-MM-DD",
  "DD-MMM-YYYY",
] as const;

export type DateFormat = (typeof DATE_FORMAT_OPTIONS)[number];

const DEFAULT_THEME: ThemeName = "dark";

interface UserPreferencesContextValue {
  language: Language;
  theme: ThemeName;
  dateFormat: DateFormat;
  defaultReceiptLanguage: Language;
  /** Update local state only — does NOT save to backend */
  updateLanguage: (lang: Language) => void;
  /** Update local state only — does NOT save to backend */
  updateTheme: (theme: ThemeName) => void;
  /** Update local state only — does NOT save to backend */
  updateDateFormat: (fmt: DateFormat) => void;
  /** Update local state only — does NOT save to backend */
  updateDefaultReceiptLanguage: (lang: Language) => void;
  /** Save all current preferences to backend — returns true on success */
  saveAllPreferences: () => Promise<boolean>;
  formatDate: (dateInput: Date | bigint | number | string) => string;
  isLoading: boolean;
}

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
    isLoading: false,
  });

function applyDateFormat(
  dateInput: Date | bigint | number | string,
  format: DateFormat,
): string {
  let d: Date;
  if (dateInput instanceof Date) {
    d = dateInput;
  } else if (typeof dateInput === "bigint") {
    d = new Date(Number(dateInput / BigInt(1_000_000)));
  } else if (typeof dateInput === "number") {
    d = new Date(dateInput);
  } else {
    d = new Date(dateInput);
  }

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

function isValidTheme(t: string): t is ThemeName {
  return ["herbal", "dark", "minimalist", "punk"].includes(t);
}

/**
 * BUG-15 fix: Language AND theme preferences are loaded from the backend
 * BEFORE rendering any app content. We block the render with `isPrefsLoading=true`
 * until the actor is ready and `getUserPreferences()` resolves.
 *
 * Theme is applied immediately via applyTheme() after load so the correct
 * CSS variable set is active before the first paint.
 */
export function UserPreferencesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { actor, isFetching: actorFetching } = useActor(createActor);

  // ── State ────────────────────────────────────────────────────────────────────
  const [language, setLanguage] = useState<Language>("en");
  const [theme, setTheme] = useState<ThemeName>(DEFAULT_THEME);
  const [dateFormat, setDateFormat] = useState<DateFormat>("DD/MM/YYYY");
  const [defaultReceiptLanguage, setDefaultReceiptLanguage] =
    useState<Language>("en");

  // true until preferences are fetched — app content is blocked during this time
  const [isPrefsLoading, setIsPrefsLoading] = useState(true);
  const fetchAttempted = useRef(false);

  // ── Fetch preferences from backend BEFORE first render ───────────────────────
  useEffect(() => {
    if (fetchAttempted.current || actorFetching || !actor) return;
    fetchAttempted.current = true;

    (async () => {
      try {
        const prefs = await actor.getUserPreferences();

        const lang = (prefs?.language as Language) || "en";
        const fmt = (prefs?.dateFormat as DateFormat) || "DD/MM/YYYY";
        const rcptLang = (prefs?.defaultReceiptLanguage as Language) || "en";
        // Theme stored as a text field in the backend
        const rawTheme = (prefs?.theme as string) || DEFAULT_THEME;
        const resolvedTheme = isValidTheme(rawTheme) ? rawTheme : DEFAULT_THEME;

        setLanguage(lang);
        setDateFormat(fmt);
        setDefaultReceiptLanguage(rcptLang);
        setTheme(resolvedTheme);

        // Apply theme class immediately so page paints in the right theme
        applyTheme(resolvedTheme);

        // Persist to localStorage for non-React consumers (e.g. t() helper)
        localStorage.setItem("inl_language", lang);
        localStorage.setItem("inl_theme", resolvedTheme);
      } catch {
        // Graceful degradation: apply default theme so UI is at least themed
        applyTheme(DEFAULT_THEME);
      } finally {
        setIsPrefsLoading(false);
      }
    })();
  }, [actor, actorFetching]);

  // ── Local-only state setters (no backend call) ───────────────────────────────
  const updateLanguage = useCallback((lang: Language) => {
    setLanguage(lang);
  }, []);

  const updateTheme = useCallback((t: ThemeName) => {
    setTheme(t);
    // Apply theme preview immediately — actual save happens on Save button
    applyTheme(t);
    localStorage.setItem("inl_theme", t);
  }, []);

  const updateDateFormat = useCallback((fmt: DateFormat) => {
    setDateFormat(fmt);
  }, []);

  const updateDefaultReceiptLanguage = useCallback((lang: Language) => {
    setDefaultReceiptLanguage(lang);
  }, []);

  // ── Save all preferences to backend in one call ──────────────────────────────
  const saveAllPreferences = useCallback(async (): Promise<boolean> => {
    if (!actor) return false;
    try {
      const ok = await actor.updateUserPreferences(
        language,
        dateFormat,
        defaultReceiptLanguage,
        "", // whatsappNumber — managed separately
        theme, // theme name stored as Text field
      );
      if (ok) {
        localStorage.setItem("inl_language", language);
        localStorage.setItem("inl_theme", theme);
        applyTheme(theme);
      }
      return ok;
    } catch {
      return false;
    }
  }, [actor, language, dateFormat, defaultReceiptLanguage, theme]);

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
        isLoading: isPrefsLoading,
      }}
    >
      {children}
    </UserPreferencesContext.Provider>
  );
}

export function useUserPreferences(): UserPreferencesContextValue {
  return useContext(UserPreferencesContext);
}

export { DATE_FORMAT_OPTIONS };
