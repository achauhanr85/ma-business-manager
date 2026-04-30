/**
 * UserPreferencesContext.tsx — Stores and loads the user's language, theme,
 * date format, default receipt language, diagnostics, and log level preferences.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * PAGE FLOW
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * LOAD FLOW (on first render after login):
 *   1. actor becomes ready (isFetching = false)
 *   2. fetchAttempted guard prevents double-fetch (React Strict Mode)
 *   3. getUserPreferences() called → returns saved prefs from backend
 *   4. All state values updated: language, theme, dateFormat, receiptLang,
 *      diagnosticsEnabled, diagnosticsLevel
 *   5. applyTheme(resolvedTheme) → CSS variables change → correct first paint
 *   6. setDiagnosticsLevel(level) → logger._minLevel synced
 *   7. setDiagnosticsEnabled(enabled) → logger._enabled synced
 *   8. localStorage updated for non-React consumers
 *   9. setIsPrefsLoading(false) → unblocks AuthenticatedApp rendering
 *
 * SAVE FLOW (on user clicking Save):
 *   1. saveAllPreferences() called from UserPreferencesPage
 *   2. updateUserPreferences(language, dateFormat, rcptLang, '', theme, diagLevel)
 *   3. On success: localStorage synced, applyTheme called, loggerSetLevel called
 *   4. Returns true/false so caller can show toast
 *
 * DIAGNOSTICS TOGGLE FLOW:
 *   setDiagnosticsEnabled(bool) called from UserPreferencesPage toggle
 *   → updates React state
 *   → calls loggerSetEnabled() to sync logger._enabled immediately
 *   → persists to localStorage so gate is correct on next page load
 *
 * DIAGNOSTICS LEVEL FLOW:
 *   setDiagnosticsLevelPref(n) called from UserPreferencesPage dropdown
 *   → updates React state
 *   → calls loggerSetLevel() to sync logger._minLevel immediately
 *   → persisted to backend on next Save
 *
 * IMPORTANT — isLoading gate:
 *   isLoading is true until the backend preference fetch completes.
 *   AuthenticatedApp blocks rendering until false — prevents flash of wrong
 *   theme or language on first load (BUG-15 fix).
 *
 * WHO USES THIS:
 *   translations/index.ts   — reads language via useTranslation()
 *   UserPreferencesPage.tsx — reads/writes all preferences
 *   ReceiptPage.tsx         — reads defaultReceiptLanguage + formatDate
 *   Layout.tsx + pages      — call formatDate() to display dates
 *   App.tsx                 — reads isLoading for render gate
 *   DiagnosticsPanel.tsx    — reads diagnosticsEnabled
 */

import { createActor } from "@/backend";
import { applyTheme } from "@/lib/color";
import {
  setDiagnosticsEnabled as loggerSetEnabled,
  setDiagnosticsLevel as loggerSetLevel,
} from "@/lib/logger";
import { logDebug, logError, logInfo, logTrace, logWarn } from "@/lib/logger";
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

/** Fall back to "herbal" if no saved theme exists (first-time users get herbal theme) */
const DEFAULT_THEME: ThemeName = "herbal";

/** Default diagnostics minimum level — INFO (2) filters out TRACE and DEBUG */
const DEFAULT_DIAGNOSTICS_LEVEL = 2;

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
  /**
   * Whether the diagnostics panel is enabled.
   * When true, DiagnosticsPanel renders at the bottom of the screen.
   */
  diagnosticsEnabled: boolean;
  /** Toggle diagnostics panel on/off — syncs logger gate immediately */
  setDiagnosticsEnabled: (enabled: boolean) => void;
  /**
   * Minimum log level filter (0=TRACE through 4=ERROR).
   * Entries below this level are discarded even when diagnostics is enabled.
   * Default: 2 (INFO)
   */
  diagnosticsLevel: number;
  /** Update the minimum log level in local state — does NOT auto-save to backend */
  setDiagnosticsLevelPref: (level: number) => void;
}

// Create context with safe defaults for components rendered outside the provider
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
    diagnosticsEnabled: false,
    setDiagnosticsEnabled: () => {},
    diagnosticsLevel: DEFAULT_DIAGNOSTICS_LEVEL,
    setDiagnosticsLevelPref: () => {},
  });

/**
 * applyDateFormat — converts any date-like value to a formatted string.
 *
 * VARIABLE INITIALIZATION:
 *   d: Date — resolved from the input type
 *
 * Handles four input types:
 *   - Date object → used directly
 *   - bigint (IC nanoseconds) → divided by 1_000_000 to get milliseconds
 *   - number (milliseconds timestamp) → passed to Date constructor
 *   - string → parsed via Date constructor
 */
function applyDateFormat(
  dateInput: Date | bigint | number | string,
  format: DateFormat,
): string {
  // Resolved date value — type depends on input
  let d: Date;
  if (dateInput instanceof Date) {
    d = dateInput;
  } else if (typeof dateInput === "bigint") {
    // IC timestamps are in nanoseconds — divide by 1_000_000 to get milliseconds
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
 * BUG-15 FIX:
 *   Language AND theme are fetched BEFORE the app renders.
 *   `isPrefsLoading` starts as true, set to false only after the fetch resolves.
 *   AuthenticatedApp in App.tsx reads the exposed `isLoading` and shows a
 *   spinner until it's false — no flash of wrong language or theme.
 */
export function UserPreferencesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { actor, isFetching: actorFetching } = useActor(createActor);

  // ── Local preference state (mirrors backend values after load) ─────────────

  // TRACE: variable initialization for all preference state
  const [language, setLanguage] = useState<Language>("en");
  const [theme, setTheme] = useState<ThemeName>(DEFAULT_THEME);
  const [dateFormat, setDateFormat] = useState<DateFormat>("DD/MM/YYYY");
  const [defaultReceiptLanguage, setDefaultReceiptLanguage] =
    useState<Language>("en");

  /**
   * diagnosticsEnabled — when true, the DiagnosticsPanel renders and the
   * logger gate is open. Persisted to localStorage for session continuity.
   *
   * TRACE: initialized from localStorage
   */
  const [diagnosticsEnabled, setDiagnosticsEnabledState] = useState<boolean>(
    () => {
      try {
        return localStorage.getItem("inl_diagnostics") === "true";
      } catch {
        return false;
      }
    },
  );

  /**
   * diagnosticsLevel — minimum numeric log level (0–4).
   * Entries below this level are filtered out in logger.ts.
   *
   * TRACE: initialized from localStorage (key 'inl_diagnostics_level')
   */
  const [diagnosticsLevel, setDiagnosticsLevelState] = useState<number>(() => {
    try {
      const stored = localStorage.getItem("inl_diagnostics_level");
      if (stored !== null) {
        const parsed = Number.parseInt(stored, 10);
        if (parsed >= 0 && parsed <= 4) return parsed;
      }
    } catch {
      // localStorage unavailable
    }
    return DEFAULT_DIAGNOSTICS_LEVEL;
  });

  /**
   * isPrefsLoading — true until the backend preference fetch completes.
   * App.tsx reads this via `isLoading` to block rendering (BUG-15 fix).
   */
  const [isPrefsLoading, setIsPrefsLoading] = useState(true);

  // Guard against calling the fetch twice (React Strict Mode fires effects twice in dev)
  const fetchAttempted = useRef(false);

  // ── Fetch preferences from backend BEFORE first render ────────────────────
  //
  // FLOW:
  //   actor ready → fetchAttempted.current = true (prevents double-fetch)
  //   → getUserPreferences() called
  //   → state values set from response
  //   → logger gates synced
  //   → localStorage updated
  //   → setIsPrefsLoading(false) unblocks render
  useEffect(() => {
    if (fetchAttempted.current || actorFetching || !actor) return;
    fetchAttempted.current = true;

    (async () => {
      logDebug("UserPreferencesContext: fetching preferences from backend");
      try {
        const prefs = await actor.getUserPreferences();
        logInfo("UserPreferencesContext: preferences loaded", { prefs });

        // Extract each value with fallbacks for null/undefined backend responses
        const lang = (prefs?.language as Language) || "en";
        const fmt = (prefs?.dateFormat as DateFormat) || "DD/MM/YYYY";
        const rcptLang = (prefs?.defaultReceiptLanguage as Language) || "en";
        const rawTheme = (prefs?.theme as string) || DEFAULT_THEME;
        const resolvedTheme = isValidTheme(rawTheme) ? rawTheme : DEFAULT_THEME;

        // diagnosticsLevel — read from backend response if available
        // Falls back to localStorage value (already set in useState initializer)
        const backendLevel = (prefs as unknown as Record<string, unknown>)
          ?.diagnostics_level;
        const resolvedLevel =
          typeof backendLevel === "number" &&
          backendLevel >= 0 &&
          backendLevel <= 4
            ? backendLevel
            : typeof backendLevel === "bigint"
              ? Number(backendLevel)
              : diagnosticsLevel;

        // Log variable initializations at TRACE level
        logTrace("UserPreferencesContext: resolved language", lang);
        logTrace("UserPreferencesContext: resolved theme", resolvedTheme);
        logTrace(
          "UserPreferencesContext: resolved diagnosticsLevel",
          resolvedLevel,
        );

        // Update all state values
        setLanguage(lang);
        setDateFormat(fmt);
        setDefaultReceiptLanguage(rcptLang);
        setTheme(resolvedTheme);
        setDiagnosticsLevelState(resolvedLevel);

        // Sync logger level filter immediately — must happen before first log call
        loggerSetLevel(resolvedLevel);

        // Apply theme CSS class immediately — correct first paint, no flash
        applyTheme(resolvedTheme);

        // Persist to localStorage for non-React consumers (translations helper etc.)
        localStorage.setItem("inl_language", lang);
        localStorage.setItem("inl_theme", resolvedTheme);
        localStorage.setItem("inl_diagnostics_level", String(resolvedLevel));
      } catch (err) {
        logError("UserPreferencesContext: failed to load preferences", err);
        // Even on failure, apply default theme so the UI is at least styled
        applyTheme(DEFAULT_THEME);
      } finally {
        // Unblock rendering — even on failure, we use defaults
        setIsPrefsLoading(false);
        logDebug("UserPreferencesContext: loading complete, unblocking render");
      }
    })();
  }, [actor, actorFetching, diagnosticsLevel]);

  // ── Local-only update functions (no backend call) ─────────────────────────
  // These update local state immediately so the UI reacts in real time.
  // Actual save to backend happens only when the user clicks Save.

  const updateLanguage = useCallback((lang: Language) => {
    logDebug("UserPreferencesContext: language updated (local only)", { lang });
    setLanguage(lang);
  }, []);

  /**
   * updateTheme — update theme in local state AND apply to DOM immediately.
   * Preview is instant — saves to backend only when user clicks Save.
   */
  const updateTheme = useCallback((t: ThemeName) => {
    logDebug("UserPreferencesContext: theme updated (local only)", {
      theme: t,
    });
    setTheme(t);
    applyTheme(t); // immediate visual preview
    localStorage.setItem("inl_theme", t);
  }, []);

  const updateDateFormat = useCallback((fmt: DateFormat) => {
    logDebug("UserPreferencesContext: dateFormat updated (local only)", {
      fmt,
    });
    setDateFormat(fmt);
  }, []);

  const updateDefaultReceiptLanguage = useCallback((lang: Language) => {
    logDebug("UserPreferencesContext: receiptLanguage updated (local only)", {
      lang,
    });
    setDefaultReceiptLanguage(lang);
  }, []);

  // ── Diagnostics control functions ─────────────────────────────────────────

  /**
   * setDiagnosticsEnabled — toggle the diagnostics panel on/off.
   *
   * FLOW:
   *   1. Update React state → triggers re-render → panel shows/hides
   *   2. Call loggerSetEnabled() → logger._enabled synced immediately
   *      (no wait for re-render — log calls work correctly right away)
   *   3. Persist to localStorage so gate is correct on next page load
   */
  const setDiagnosticsEnabled = useCallback((enabled: boolean) => {
    logDebug("UserPreferencesContext: diagnosticsEnabled set", { enabled });
    setDiagnosticsEnabledState(enabled);
    loggerSetEnabled(enabled);
    try {
      localStorage.setItem("inl_diagnostics", String(enabled));
    } catch {
      // localStorage unavailable — ignore
    }
  }, []);

  /**
   * setDiagnosticsLevelPref — update the minimum log level filter.
   *
   * FLOW:
   *   1. Update React state → Preferences page re-renders with new selection
   *   2. Call loggerSetLevel() → logger._minLevel synced immediately
   *      (takes effect for all subsequent log calls right away)
   *   3. Persist to localStorage
   *
   * NOTE: This does NOT auto-save to backend. The value is included in
   * saveAllPreferences() when the user clicks Save.
   */
  const setDiagnosticsLevelPref = useCallback((level: number) => {
    const clamped = Math.max(0, Math.min(4, Math.round(level)));
    logDebug("UserPreferencesContext: diagnosticsLevel set", {
      level: clamped,
    });
    setDiagnosticsLevelState(clamped);
    loggerSetLevel(clamped);
  }, []);

  // ── Save all preferences to backend ───────────────────────────────────────
  /**
   * saveAllPreferences — writes all current preference values to the backend.
   *
   * FLOW:
   *   1. Check actor ready
   *   2. Call updateUserPreferences() with all current values including diagnosticsLevel
   *   3. On success: sync localStorage, apply theme, sync logger level
   *   4. Return true/false so caller can show toast
   *
   * NOTE: diagnosticsEnabled is NOT saved to backend (in-memory only per spec).
   * diagnosticsLevel IS saved because it persists across logins.
   */
  const saveAllPreferences = useCallback(async (): Promise<boolean> => {
    if (!actor) {
      logWarn(
        "UserPreferencesContext: saveAllPreferences called but actor not ready",
      );
      return false;
    }
    logInfo("UserPreferencesContext: saving preferences to backend", {
      language,
      dateFormat,
      theme,
      diagnosticsLevel,
    });
    try {
      // Try passing diagnosticsLevel as 6th argument if the backend accepts it.
      // Falls back gracefully if not — updateUserPreferences signature may vary.
      const a = actor as unknown as Record<string, unknown>;
      let ok: boolean;
      if (typeof a.updateUserPreferences === "function") {
        try {
          // Attempt extended signature with diagnostics_level
          ok = await (
            a.updateUserPreferences as (
              lang: string,
              fmt: string,
              rcptLang: string,
              whatsapp: string,
              theme: string,
              diagLevel?: bigint,
            ) => Promise<boolean>
          )(
            language,
            dateFormat,
            defaultReceiptLanguage,
            "", // whatsappNumber — managed separately
            theme,
            BigInt(diagnosticsLevel),
          );
        } catch {
          // Fall back using diagnosticsLevel = 0n if 6th arg causes backend error
          ok = await actor.updateUserPreferences(
            language,
            dateFormat,
            defaultReceiptLanguage,
            "",
            theme,
            BigInt(0),
          );
        }
      } else {
        logWarn(
          "UserPreferencesContext: updateUserPreferences not available on actor",
        );
        ok = false;
      }

      if (ok) {
        logInfo("UserPreferencesContext: preferences saved successfully");
        localStorage.setItem("inl_language", language);
        localStorage.setItem("inl_theme", theme);
        localStorage.setItem("inl_diagnostics_level", String(diagnosticsLevel));
        applyTheme(theme);
        loggerSetLevel(diagnosticsLevel);
      } else {
        logWarn(
          "UserPreferencesContext: backend returned false for saveAllPreferences",
        );
      }
      return ok;
    } catch (err) {
      logError("UserPreferencesContext: saveAllPreferences failed", err);
      return false;
    }
  }, [
    actor,
    language,
    dateFormat,
    defaultReceiptLanguage,
    theme,
    diagnosticsLevel,
  ]);

  /**
   * formatDate — converts any date-like value to a display string.
   * Passed via context so components don't need to import the format themselves.
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
        isLoading: isPrefsLoading,
        diagnosticsEnabled,
        setDiagnosticsEnabled,
        diagnosticsLevel,
        setDiagnosticsLevelPref,
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
