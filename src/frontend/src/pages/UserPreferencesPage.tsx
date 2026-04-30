/**
 * UserPreferencesPage.tsx — User-facing preferences form.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * PAGE FLOW
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * LOAD FLOW:
 *   1. isLoading = true → show spinner (waiting for backend prefs to load)
 *   2. isLoading = false → render all preference sections
 *   3. All form fields initialized from context state (loaded from backend)
 *
 * FORM INTERACTION FLOW (local state only — no auto-save):
 *   User changes theme → updateTheme() → CSS applied immediately (live preview)
 *   User changes language → updateLanguage() → no visual change until Save
 *   User changes date format → updateDateFormat() → no visual change until Save
 *   User changes receipt language → updateDefaultReceiptLanguage()
 *   User changes diagnostics toggle → setDiagnosticsEnabled() → panel shows/hides
 *   User changes log level → setDiagnosticsLevelPref() → filter applied immediately
 *
 * SAVE FLOW:
 *   1. User clicks Save → handleSave() called
 *   2. setIsSaving(true) → button shows spinner
 *   3. saveAllPreferences() called → writes all prefs to backend
 *      (includes diagnosticsLevel, excludes diagnosticsEnabled per spec)
 *   4. Success → toast shown → 1.8s timer → logout() called
 *      (logout required so new language/theme applies cleanly on re-login)
 *   5. Failure → toast error shown
 *   6. setIsSaving(false) in finally block
 *
 * DIAGNOSTICS SECTION FLOW:
 *   diagnosticsEnabled = false → toggle shown, level selector HIDDEN
 *   diagnosticsEnabled = true  → toggle shown AND level selector shown
 *   Level selector: 5 options (0=Trace through 4=Error)
 *   Selecting level does NOT auto-save — included in Save click
 *
 * DIAGNOSTIC LOGGING:
 *   TRACE (0): component mounted, initial values
 *   DEBUG (1): each preference change event
 *   INFO  (2): save initiated, save result
 *   ERROR (4): save failure
 *
 * WHO USES THIS:
 *   App.tsx — rendered when route === ROUTES.userPreferences
 */

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  DATE_FORMAT_OPTIONS,
  UserPreferencesContext,
} from "@/contexts/UserPreferencesContext";
import type { ThemeName } from "@/contexts/UserPreferencesContext";
import { useAuth } from "@/hooks/useAuth";
import { logDebug, logError, logInfo, logTrace } from "@/lib/logger";
import { useTranslation } from "@/translations";
import {
  Bug,
  Calendar,
  CheckCircle2,
  Globe,
  Languages,
  LogOut,
  Palette,
  Receipt,
  RefreshCw,
  Save,
} from "lucide-react";
import { useContext, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface UserPreferencesPageProps {
  onNavigate: (path: string) => void;
}

const LANGUAGES = [
  { value: "en", flag: "🇬🇧" },
  { value: "gu", flag: "🇮🇳" },
  { value: "hi", flag: "🇮🇳" },
] as const;

type Language = "en" | "gu" | "hi";

const THEMES: { value: ThemeName; emoji: string; descKey: string }[] = [
  { value: "dark", emoji: "🌑", descKey: "themeDark" },
  { value: "herbal", emoji: "🌿", descKey: "themeHerbal" },
  { value: "minimalist", emoji: "⬜", descKey: "themeMinimalist" },
  { value: "punk", emoji: "⚡", descKey: "themePunk" },
];

/**
 * LOG_LEVEL_OPTIONS — the five selectable minimum log levels.
 *
 * VARIABLE INITIALIZATION:
 *   value: number — the numeric level (0–4)
 *   label: string — shown in the dropdown
 *   description: string — hint text below the dropdown
 */
const LOG_LEVEL_OPTIONS = [
  { value: 0, label: "0 — Trace (most verbose)" },
  { value: 1, label: "1 — Debug" },
  { value: 2, label: "2 — Info (default)" },
  { value: 3, label: "3 — Warn" },
  { value: 4, label: "4 — Error (least verbose)" },
] as const;

export function UserPreferencesPage({
  onNavigate: _onNavigate,
}: UserPreferencesPageProps) {
  const {
    language,
    theme,
    dateFormat,
    defaultReceiptLanguage,
    updateLanguage,
    updateTheme,
    updateDateFormat,
    updateDefaultReceiptLanguage,
    saveAllPreferences,
    isLoading,
    diagnosticsEnabled,
    setDiagnosticsEnabled,
    diagnosticsLevel,
    setDiagnosticsLevelPref,
  } = useContext(UserPreferencesContext);

  const { logout } = useAuth();
  const t = useTranslation();

  // TRACE: variable initialization for page state
  const [isSaving, setIsSaving] = useState(false);
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  logTrace("UserPreferencesPage: mounted", {
    language,
    theme,
    dateFormat,
    diagnosticsEnabled,
    diagnosticsLevel,
  });

  // Clean up logout timer on unmount
  useEffect(() => {
    logDebug("UserPreferencesPage: component mounted");
    return () => {
      logDebug(
        "UserPreferencesPage: component unmounting, clearing logout timer",
      );
      if (logoutTimerRef.current !== null) {
        clearTimeout(logoutTimerRef.current);
      }
    };
  }, []);

  /**
   * handleSave — persists all saveable preferences to the backend.
   *
   * FLOW:
   *   1. setIsSaving(true) → button shows spinner
   *   2. saveAllPreferences() → writes to backend (includes diagnosticsLevel)
   *   3. Success → toast → 1.8s timer → logout() (new lang/theme needs fresh login)
   *   4. Failure → toast error
   *   5. finally → setIsSaving(false)
   *
   * NOTE: diagnosticsEnabled is NOT saved here — it is in-memory only per spec.
   * diagnosticsLevel IS included in saveAllPreferences().
   */
  const handleSave = async () => {
    logInfo("UserPreferencesPage: Save button clicked", {
      language,
      theme,
      dateFormat,
      diagnosticsLevel,
    });
    setIsSaving(true);
    try {
      const ok = await saveAllPreferences();
      if (ok) {
        logInfo("UserPreferencesPage: preferences saved successfully");
        toast.success(t.userPreferences.preferencesSaved, { duration: 5000 });
        logoutTimerRef.current = setTimeout(() => {
          logInfo("UserPreferencesPage: auto-logout after save");
          logout();
        }, 1800);
      } else {
        logError("UserPreferencesPage: saveAllPreferences returned false");
        toast.error("Failed to save preferences. Please try again.");
      }
    } catch (err) {
      logError("UserPreferencesPage: handleSave threw an error", err);
      toast.error("Failed to save preferences. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div
        className="p-4 flex items-center justify-center min-h-40"
        data-ocid="user_preferences.loading_state"
      >
        <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const langLabels: Record<Language, string> = {
    en: t.userPreferences.english,
    gu: t.userPreferences.gujarati,
    hi: t.userPreferences.hindi,
  };

  return (
    <div className="space-y-6 max-w-xl pb-8" data-ocid="user_preferences.page">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Globe className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-display font-bold text-foreground">
              {t.userPreferences.title}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Personalise your app experience. Saved per user account.
            </p>
          </div>
        </div>
      </div>

      {/* ── Theme selector ── */}
      <Card data-ocid="user_preferences.theme_section">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Palette className="w-4 h-4 text-primary" />
            {t.userPreferences.theme}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {THEMES.map((th) => {
              const label = t.userPreferences[
                th.descKey as keyof typeof t.userPreferences
              ] as string;
              return (
                <label
                  key={th.value}
                  className={`
                    flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors
                    ${
                      theme === th.value
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border hover:bg-muted/40"
                    }
                  `}
                  data-ocid={`user_preferences.theme_${th.value}`}
                >
                  <input
                    type="radio"
                    name="theme"
                    value={th.value}
                    checked={theme === th.value}
                    onChange={() => {
                      logDebug("UserPreferencesPage: theme changed", {
                        theme: th.value,
                      });
                      updateTheme(th.value);
                    }}
                    className="accent-primary"
                  />
                  <span className="text-lg">{th.emoji}</span>
                  <span className="text-sm font-medium text-foreground flex-1">
                    {label}
                  </span>
                  {theme === th.value && (
                    <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                  )}
                </label>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground pt-1">
            Theme preview applies instantly. Save to persist across logins.
          </p>
        </CardContent>
      </Card>

      <Separator />

      {/* ── Language ── */}
      <Card data-ocid="user_preferences.language_section">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Languages className="w-4 h-4 text-primary" />
            {t.userPreferences.language}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            {LANGUAGES.map((lang) => (
              <label
                key={lang.value}
                className={`
                  flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors
                  ${
                    language === lang.value
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border hover:bg-muted/40"
                  }
                `}
                data-ocid={`user_preferences.language_${lang.value}`}
              >
                <input
                  type="radio"
                  name="language"
                  value={lang.value}
                  checked={language === lang.value}
                  onChange={() => {
                    logDebug("UserPreferencesPage: language changed", {
                      lang: lang.value,
                    });
                    updateLanguage(lang.value as Language);
                  }}
                  className="accent-primary"
                />
                <span className="text-lg">{lang.flag}</span>
                <span className="text-sm font-medium text-foreground flex-1">
                  {langLabels[lang.value]}
                </span>
                {language === lang.value && (
                  <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                )}
              </label>
            ))}
          </div>

          {/* Language change note */}
          <div className="rounded-lg border border-amber-300/50 bg-amber-50/60 dark:bg-amber-950/20 dark:border-amber-800/30 px-3 py-2.5">
            <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
              <strong>Note:</strong> After saving, you will be logged out
              automatically. Log back in to see the app in your selected
              language.
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2 w-full"
            onClick={() => window.location.reload()}
            data-ocid="user_preferences.refresh_ui_button"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh UI
          </Button>
        </CardContent>
      </Card>

      <Separator />

      {/* ── Date Format ── */}
      <Card data-ocid="user_preferences.date_format_section">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />
            {t.userPreferences.dateFormat}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            {DATE_FORMAT_OPTIONS.map((fmt) => (
              <label
                key={fmt}
                className={`
                  flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors
                  ${
                    dateFormat === fmt
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border hover:bg-muted/40"
                  }
                `}
                data-ocid={`user_preferences.date_format_${fmt.replace(/\//g, "_")}`}
              >
                <input
                  type="radio"
                  name="dateFormat"
                  value={fmt}
                  checked={dateFormat === fmt}
                  onChange={() => {
                    logDebug("UserPreferencesPage: dateFormat changed", {
                      fmt,
                    });
                    updateDateFormat(fmt);
                  }}
                  className="accent-primary"
                />
                <span className="text-sm font-medium text-foreground font-mono">
                  {fmt}
                </span>
              </label>
            ))}
          </div>
          <p className="text-xs text-muted-foreground pt-1">
            This format is used for all dates across the app.
          </p>
        </CardContent>
      </Card>

      <Separator />

      {/* ── Default Receipt Language ── */}
      <Card data-ocid="user_preferences.receipt_language_section">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Receipt className="w-4 h-4 text-primary" />
            {t.userPreferences.defaultReceiptLanguage}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Default language for generated receipts. You can override this when
            printing each receipt.
          </p>
          <div className="space-y-2">
            {LANGUAGES.map((lang) => (
              <label
                key={lang.value}
                className={`
                  flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors
                  ${
                    defaultReceiptLanguage === lang.value
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border hover:bg-muted/40"
                  }
                `}
                data-ocid={`user_preferences.receipt_language_${lang.value}`}
              >
                <input
                  type="radio"
                  name="receiptLanguage"
                  value={lang.value}
                  checked={defaultReceiptLanguage === lang.value}
                  onChange={() => {
                    logDebug("UserPreferencesPage: receiptLanguage changed", {
                      lang: lang.value,
                    });
                    updateDefaultReceiptLanguage(lang.value as Language);
                  }}
                  className="accent-primary"
                />
                <span className="text-lg">{lang.flag}</span>
                <span className="text-sm font-medium text-foreground flex-1">
                  {langLabels[lang.value]}
                </span>
                {defaultReceiptLanguage === lang.value && (
                  <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                )}
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* ── Diagnostics Panel ─────────────────────────────────────────────────
          Toggle: auto-applies immediately (in-memory only, not saved to backend)
          Level: applies immediately via loggerSetLevel, saved to backend on Save
      ── */}
      <Card data-ocid="user_preferences.diagnostics_section">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Bug className="w-4 h-4 text-primary" />
            Diagnostics
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Toggle row */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">
                Enable Diagnostics Panel
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Shows a debug log panel at the bottom of the screen. Logs
                backend API calls, navigation events, and errors in real time.
              </p>
            </div>
            <Switch
              checked={diagnosticsEnabled}
              onCheckedChange={(enabled) => {
                logDebug("UserPreferencesPage: diagnosticsEnabled toggled", {
                  enabled,
                });
                setDiagnosticsEnabled(enabled);
              }}
              data-ocid="user_preferences.diagnostics_toggle"
              aria-label="Enable diagnostics panel"
            />
          </div>

          {/* Level selector — only shown when diagnostics is enabled */}
          {diagnosticsEnabled && (
            <div className="space-y-2 pt-1 border-t border-border">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">
                    Minimum Log Level
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Shows only logs at this level and above.
                  </p>
                </div>
              </div>
              <select
                value={diagnosticsLevel}
                onChange={(e) => {
                  const level = Number.parseInt(e.target.value, 10);
                  logDebug("UserPreferencesPage: diagnosticsLevel changed", {
                    level,
                  });
                  setDiagnosticsLevelPref(level);
                }}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                data-ocid="user_preferences.diagnostics_level_select"
                aria-label="Minimum log level"
              >
                {LOG_LEVEL_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                0=Trace captures everything. 4=Error only shows failures. 2=Info
                (default) shows API calls and major events. Changes apply
                immediately and are saved with your preferences.
              </p>
            </div>
          )}

          {/* Info box */}
          <div className="rounded-lg border border-blue-200/60 bg-blue-50/40 dark:bg-blue-950/20 dark:border-blue-800/30 px-3 py-2.5">
            <p className="text-xs text-blue-700 dark:text-blue-400 leading-relaxed">
              <strong>Developer tool:</strong> The on/off toggle is in-memory
              only — it resets to OFF when you refresh the page. The log level
              is saved to your account when you click Save below.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ── Save Button ── */}
      <div
        className="sticky bottom-4 pt-2"
        data-ocid="user_preferences.save_section"
      >
        <Button
          className="w-full gap-2 shadow-lg"
          size="lg"
          onClick={handleSave}
          disabled={isSaving}
          data-ocid="user_preferences.save_button"
        >
          {isSaving ? (
            <>
              <span className="w-4 h-4 border-2 border-primary-foreground/40 border-t-primary-foreground rounded-full animate-spin" />
              Saving & Logging Out…
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              {t.userPreferences.savePreferences}
            </>
          )}
        </Button>
        <p className="text-xs text-muted-foreground text-center mt-2 flex items-center justify-center gap-1.5">
          <LogOut className="w-3 h-3" />
          You will be logged out automatically after saving so changes take
          effect.
        </p>
      </div>
    </div>
  );
}
