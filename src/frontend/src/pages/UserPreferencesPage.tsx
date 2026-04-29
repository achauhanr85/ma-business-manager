/**
 * UserPreferencesPage.tsx — User-facing preferences form.
 *
 * WHAT THIS FILE DOES:
 * Allows users to configure:
 *   - UI Theme (Dark, Herbal, Minimalist, Punk) — live preview, saved on Save
 *   - Language (English, Gujarati, Hindi) — saved on Save, logout required to apply
 *   - Date Format — saved on Save
 *   - Default Receipt Language — saved on Save
 *   - Diagnostics Panel toggle — IN-MEMORY ONLY, takes effect immediately, not saved
 *
 * SAVE BEHAVIOUR:
 * All saved preferences (theme, language, date format, receipt language) require
 * clicking the Save button. After saving, the user is automatically logged out so
 * the new language/theme can reload cleanly.
 *
 * EXCEPTION — Diagnostics:
 * The diagnostics toggle is the one auto-apply exception. It is stored in memory only
 * (resets on refresh) and takes effect the moment it is toggled — no Save button needed.
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

/** Visual theme options with emoji and translation key */
const THEMES: { value: ThemeName; emoji: string; descKey: string }[] = [
  { value: "dark", emoji: "🌑", descKey: "themeDark" },
  { value: "herbal", emoji: "🌿", descKey: "themeHerbal" },
  { value: "minimalist", emoji: "⬜", descKey: "themeMinimalist" },
  { value: "punk", emoji: "⚡", descKey: "themePunk" },
];

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
  } = useContext(UserPreferencesContext);

  const { logout } = useAuth();
  const t = useTranslation();
  const [isSaving, setIsSaving] = useState(false);
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up logout timer on unmount to avoid calling logout after navigation
  useEffect(() => {
    return () => {
      if (logoutTimerRef.current !== null) {
        clearTimeout(logoutTimerRef.current);
      }
    };
  }, []);

  /**
   * handleSave — persists all saveable preferences to the backend.
   * On success, auto-logs out after 1.8s so the new language/theme take effect.
   * NOTE: diagnosticsEnabled is NOT saved here — it is in-memory only.
   */
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const ok = await saveAllPreferences();
      if (ok) {
        toast.success(t.userPreferences.preferencesSaved, { duration: 5000 });
        logoutTimerRef.current = setTimeout(() => {
          logout();
        }, 1800);
      } else {
        toast.error("Failed to save preferences. Please try again.");
      }
    } catch {
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
                    onChange={() => updateTheme(th.value)}
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
                  onChange={() => updateLanguage(lang.value as Language)}
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

          {/* Refresh button — re-applies saved language without logging out */}
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
                  onChange={() => updateDateFormat(fmt)}
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
                  onChange={() =>
                    updateDefaultReceiptLanguage(lang.value as Language)
                  }
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

      {/* ── Diagnostics Panel toggle ──────────────────────────────────────────
          This is the ONLY preference that auto-applies and is NOT saved to the
          backend. It resets to OFF on every page refresh. Useful for debugging
          backend calls and navigation events in the browser.
      ── */}
      <Card data-ocid="user_preferences.diagnostics_section">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Bug className="w-4 h-4 text-primary" />
            Diagnostics
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
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
              onCheckedChange={setDiagnosticsEnabled}
              data-ocid="user_preferences.diagnostics_toggle"
              aria-label="Enable diagnostics panel"
            />
          </div>
          <div className="rounded-lg border border-blue-200/60 bg-blue-50/40 dark:bg-blue-950/20 dark:border-blue-800/30 px-3 py-2.5">
            <p className="text-xs text-blue-700 dark:text-blue-400 leading-relaxed">
              <strong>Developer tool:</strong> This setting is in-memory only —
              it resets to OFF when you refresh the page. It is not saved to
              your account and does not affect other users.
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
