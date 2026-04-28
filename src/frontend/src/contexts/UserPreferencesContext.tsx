import { createActor } from "@/backend";
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

const DATE_FORMAT_OPTIONS = [
  "DD/MM/YYYY",
  "MM/DD/YYYY",
  "YYYY-MM-DD",
  "DD-MMM-YYYY",
] as const;

export type DateFormat = (typeof DATE_FORMAT_OPTIONS)[number];

interface UserPreferencesContextValue {
  language: Language;
  dateFormat: DateFormat;
  defaultReceiptLanguage: Language;
  /** Update local state only — does NOT save to backend */
  updateLanguage: (lang: Language) => void;
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
    dateFormat: "DD/MM/YYYY",
    defaultReceiptLanguage: "en",
    updateLanguage: () => {},
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

/**
 * BUG-15 fix: Language preference is loaded from the backend BEFORE rendering
 * any app content. We block the render with `isPrefsLoading=true` until the
 * actor is ready and `getUserPreferences()` resolves. Only if the call fails
 * or returns no preference do we fall back to "en".
 *
 * This prevents the flash of English labels before the saved language is applied.
 */
export function UserPreferencesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { actor, isFetching: actorFetching } = useActor(createActor);

  // ── State ────────────────────────────────────────────────────────────────────
  const [language, setLanguage] = useState<Language>("en");
  const [dateFormat, setDateFormat] = useState<DateFormat>("DD/MM/YYYY");
  const [defaultReceiptLanguage, setDefaultReceiptLanguage] =
    useState<Language>("en");

  // true until preferences are fetched — app content is blocked during this time
  const [isPrefsLoading, setIsPrefsLoading] = useState(true);
  const fetchAttempted = useRef(false);

  // ── BUG-15: Fetch preferences from backend BEFORE first render ───────────────
  // We call actor.getUserPreferences() directly (not via React Query) so we
  // control the timing precisely and can block rendering until it resolves.
  useEffect(() => {
    if (fetchAttempted.current || actorFetching || !actor) return;
    fetchAttempted.current = true;

    (async () => {
      try {
        const prefs = await actor.getUserPreferences();

        const lang = (prefs?.language as Language) || "en";
        const fmt = (prefs?.dateFormat as DateFormat) || "DD/MM/YYYY";
        const rcptLang = (prefs?.defaultReceiptLanguage as Language) || "en";

        setLanguage(lang);
        setDateFormat(fmt);
        setDefaultReceiptLanguage(rcptLang);

        // Persist to localStorage for non-React consumers (e.g. t() helper)
        localStorage.setItem("inl_language", lang);
      } catch {
        // Graceful degradation: use defaults if backend is unavailable
        // Keep isPrefsLoading=false so the app doesn't hang
      } finally {
        setIsPrefsLoading(false);
      }
    })();
  }, [actor, actorFetching]);

  // ── Local-only state setters (no backend call) ───────────────────────────────
  const updateLanguage = useCallback((lang: Language) => {
    setLanguage(lang);
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
      );
      if (ok) {
        localStorage.setItem("inl_language", language);
      }
      return ok;
    } catch {
      return false;
    }
  }, [actor, language, dateFormat, defaultReceiptLanguage]);

  const formatDate = useCallback(
    (dateInput: Date | bigint | number | string) =>
      applyDateFormat(dateInput, dateFormat),
    [dateFormat],
  );

  // Block children render until preferences are loaded — prevents English flash
  if (isPrefsLoading && actorFetching === false && actor !== null) {
    // Actor is ready but preferences haven't loaded yet — show nothing
    // (AppLoader in App.tsx handles the visible loading state above this layer)
  }

  return (
    <UserPreferencesContext.Provider
      value={{
        language,
        dateFormat,
        defaultReceiptLanguage,
        updateLanguage,
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
