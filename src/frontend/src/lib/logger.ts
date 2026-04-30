/**
 * logger.ts — Gated in-memory logger for the Diagnostics Panel.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCHITECTURE OVERVIEW
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * This module provides a ZERO-OVERHEAD logging system. The core design rule is:
 *
 *   ► If diagnostics is DISABLED — every log call returns immediately without
 *     doing ANY work. No string allocation, no array push, no listener notify.
 *     This is critical for production performance because log calls are spread
 *     throughout hooks and components that run on every render/mutation.
 *
 *   ► If diagnostics is ENABLED — entries are appended to a circular buffer
 *     (max 200 entries) and all subscribed listeners are notified synchronously.
 *     The DiagnosticsPanel is the only subscriber in practice.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * SENTINEL DESIGN: setDiagnosticsEnabled()
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The enabled state is stored as a module-level boolean `_enabled`. It is
 * kept in sync with the React context via `setDiagnosticsEnabled()`, which
 * UserPreferencesContext calls whenever `diagnosticsEnabled` changes.
 *
 * Why not use the React context directly inside logger.ts?
 *   logger.ts has NO React dependency — it is imported from hooks, contexts,
 *   and utility files that run outside the React tree. Importing `useContext`
 *   here would cause a runtime error. Instead, the context "pushes" the value
 *   into the logger module via `setDiagnosticsEnabled()`.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * LOG LEVELS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   debug — general debug info (grey)          logDebug()
 *   api   — backend actor call events (blue)   logApi()
 *   error — caught exceptions (red)            logError()
 *   nav   — route/navigation transitions (green) logNav()
 *   auth  — login / logout / role events (purple) logAuth()
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHO USES THIS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   hooks/useBackend.ts         — logApi() before/after every actor call
 *   App.tsx                     — logNav() on route changes
 *   contexts/UserPreferencesContext.tsx — setDiagnosticsEnabled() on pref change
 *   components/DiagnosticsPanel.tsx     — subscribe() + getEntries() to render
 */

// ── Types ────────────────────────────────────────────────────────────────────

/** A single log entry stored in the circular buffer */
export interface LogEntry {
  /** Monotonically increasing ID — used as React key in DiagnosticsPanel */
  id: number;
  /** HH:MM:SS timestamp captured when the entry was created */
  timestamp: string;
  /** Log level — controls the colour badge in DiagnosticsPanel */
  level: "debug" | "api" | "error" | "nav" | "auth";
  /** The log message text */
  message: string;
}

// ── Module-level state ───────────────────────────────────────────────────────

/** Maximum number of entries retained in the circular buffer */
const MAX_ENTRIES = 200;

/**
 * _enabled — master gate for all logging.
 *
 * When false (the default), every log function returns immediately without
 * doing any work. Set to true via setDiagnosticsEnabled(true) — called by
 * UserPreferencesContext when the user enables the diagnostics panel.
 *
 * Initialised from localStorage so the gate is correct on module load (before
 * the React context has a chance to call setDiagnosticsEnabled).
 */
let _enabled = false;
try {
  _enabled = localStorage.getItem("inl_diagnostics") === "true";
} catch {
  // localStorage unavailable (e.g. private browsing restrictions) — stay false
}

/** The in-memory circular log buffer */
let logEntries: LogEntry[] = [];

/** Monotonically increasing ID counter — never resets even after buffer trim */
let nextId = 0;

/**
 * listeners — callbacks registered by subscribers (DiagnosticsPanel registers one).
 * Each listener is called synchronously after every append() so the panel re-renders.
 */
const listeners: (() => void)[] = [];

// ── Public control API ───────────────────────────────────────────────────────

/**
 * setDiagnosticsEnabled — updates the gate that controls whether log calls
 * do any work. Must be called by UserPreferencesContext whenever the
 * `diagnosticsEnabled` preference changes.
 *
 * When switching from enabled → disabled, the existing buffer is cleared
 * so the panel doesn't show stale entries if it is re-opened later.
 */
export function setDiagnosticsEnabled(enabled: boolean): void {
  const wasEnabled = _enabled;
  _enabled = enabled;

  // Clear the buffer when disabling — stale entries from a previous session
  // would be confusing if diagnostics is re-enabled later.
  if (wasEnabled && !enabled) {
    logEntries = [];
    nextId = 0;
  }

  // Persist to localStorage so the gate is correct on next page load
  // (before UserPreferencesContext has a chance to call this again).
  try {
    localStorage.setItem("inl_diagnostics", String(enabled));
  } catch {
    // localStorage unavailable — ignore
  }
}

/**
 * subscribe — register a callback to be called after every new log entry.
 * Returns an unsubscribe function — call it in useEffect cleanup.
 *
 * Example:
 *   useEffect(() => {
 *     const unsub = subscribe(() => setEntries(getEntries()));
 *     return unsub; // called on unmount
 *   }, []);
 */
export function subscribe(listener: () => void): () => void {
  listeners.push(listener);
  return () => {
    const index = listeners.indexOf(listener);
    if (index !== -1) listeners.splice(index, 1);
  };
}

/**
 * getEntries — returns a shallow copy of all current log entries.
 * DiagnosticsPanel calls this after every subscribe notification.
 */
export function getEntries(): LogEntry[] {
  return [...logEntries];
}

// ── Internal helpers ─────────────────────────────────────────────────────────

/** Returns the current time formatted as HH:MM:SS for the timestamp column */
function now(): string {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

/**
 * append — the single write path for all log functions.
 *
 * GUARD: returns immediately if _enabled is false. This is intentional and
 * is the most performance-critical line in the entire logger — it prevents
 * ANY string allocation or array mutation when diagnostics is off.
 *
 * After appending, trims the buffer to MAX_ENTRIES and notifies all listeners.
 */
function append(level: LogEntry["level"], message: string): void {
  // ── ZERO-OVERHEAD GATE ────────────────────────────────────────────────────
  // This check MUST be the very first thing in this function.
  // Do NOT move any allocations above this line.
  if (!_enabled) return;
  // ─────────────────────────────────────────────────────────────────────────

  const entry: LogEntry = { id: nextId++, timestamp: now(), level, message };
  logEntries.push(entry);

  // Circular buffer: drop the oldest entries when over the limit
  if (logEntries.length > MAX_ENTRIES) {
    logEntries = logEntries.slice(logEntries.length - MAX_ENTRIES);
  }

  // Notify all subscribers synchronously so the panel re-renders immediately
  for (const l of listeners) l();
}

// ── Public log functions ─────────────────────────────────────────────────────
//
// Each function is a thin wrapper around append(). All gating happens inside
// append() — there is no need for callers to check _enabled before calling.

/**
 * logDebug — general debugging information.
 * Use for component lifecycle events, computed values, or flow checkpoints.
 */
export function logDebug(message: string): void {
  append("debug", message);
}

/**
 * logApi — backend actor call events.
 * Convention: "→ methodName args" before the call, "← methodName OK" after.
 * Do NOT log sensitive data (no passwords, no raw principals).
 */
export function logApi(message: string): void {
  append("api", message);
}

/**
 * logError — caught exceptions or failed backend calls.
 * Pass the error message string, not the raw Error object, to keep entries readable.
 */
export function logError(message: string): void {
  append("error", message);
}

/**
 * logNav — route / navigation transition events.
 * Called from App.tsx on every path change. Format: "NAV: /from → /to"
 */
export function logNav(message: string): void {
  append("nav", message);
}

/**
 * logAuth — authentication and role events.
 * Use for: login, logout, profile switch, role impersonation start/stop.
 * Do NOT log principals or other identity data.
 */
export function logAuth(message: string): void {
  append("auth", message);
}
