/**
 * logger.ts — Gated in-memory logger for the Diagnostics Panel.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * PAGE FLOW / ARCHITECTURE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * FLOW DIAGRAM:
 *   [App code calls logTrace/logDebug/logInfo/logWarn/logError]
 *          │
 *          ▼
 *   append(level, message, data?)
 *          │
 *          ├── _enabled? NO  → return immediately (ZERO overhead)
 *          ├── entry.level < _minLevel? YES → return (filtered out)
 *          │
 *          ▼
 *   Push LogEntry to circular buffer (max 200)
 *          │
 *          ▼
 *   Notify all subscribers (DiagnosticsPanel re-renders)
 *
 * LEVEL HIERARCHY (numeric, 0 = most verbose):
 *   0 = TRACE — variable initialization, very fine-grained
 *   1 = DEBUG — function entry, navigation, role checks
 *   2 = INFO  — API calls and responses (default minimum)
 *   3 = WARN  — warning conditions, empty results, fallbacks
 *   4 = ERROR — caught exceptions and failures
 *
 * ZERO-OVERHEAD GUARANTEE:
 *   When _enabled = false, every log call returns immediately without
 *   allocating strings, pushing to arrays, or notifying listeners.
 *   _minLevel provides a second filter — entries below the minimum are
 *   discarded even when diagnostics is enabled.
 *
 * BACKWARD COMPATIBILITY:
 *   Old named-level functions (logApi, logNav, logAuth, logDebug, logError)
 *   are preserved and mapped to numeric levels so existing call sites
 *   continue to work without changes.
 *
 * WHO USES THIS:
 *   hooks/useBackend.ts             — loggedCall wrapper (INFO level)
 *   hooks/useAuth.ts                — login/logout events (DEBUG/INFO)
 *   contexts/ProfileContext.tsx     — profile fetch events (DEBUG/INFO)
 *   contexts/UserPreferencesContext.tsx — setDiagnosticsEnabled/setMinLevel
 *   contexts/ImpersonationContext.tsx — impersonation events (DEBUG)
 *   components/DiagnosticsPanel.tsx — subscribe() + getEntries()
 *   All pages                       — useEffect, handler, fetch logging
 */

// ── Types ────────────────────────────────────────────────────────────────────

/** Numeric log levels — 0 is most verbose, 4 is most severe */
export type LogLevel = 0 | 1 | 2 | 3 | 4;

/** Human-readable level name displayed in the panel badge */
export type LogLevelName = "TRACE" | "DEBUG" | "INFO" | "WARN" | "ERROR";

/** A single log entry stored in the circular buffer */
export interface LogEntry {
  /** Monotonically increasing ID — used as React key in DiagnosticsPanel */
  id: number;
  /** HH:MM:SS timestamp captured when the entry was created */
  timestamp: string;
  /** Numeric log level (0–4) — controls filtering and badge colour */
  level: LogLevel;
  /** Human-readable level name — shown in the panel badge */
  levelName: LogLevelName;
  /** The log message text */
  message: string;
  /** Optional structured data attached to the log entry (expandable in panel) */
  data?: unknown;
}

// ── Module-level state ───────────────────────────────────────────────────────

/** Maximum number of entries retained in the circular buffer */
const MAX_ENTRIES = 200;

/**
 * _enabled — master gate for all logging.
 *
 * When false (default), every log call returns without doing any work.
 * Set via setDiagnosticsEnabled() — called by UserPreferencesContext.
 *
 * Initialised from localStorage so the gate is correct on module load,
 * before the React context has a chance to call setDiagnosticsEnabled.
 */
let _enabled = false;
try {
  _enabled = localStorage.getItem("inl_diagnostics") === "true";
} catch {
  // localStorage unavailable (e.g. private browsing) — stay false
}

/**
 * _minLevel — minimum log level to include in the buffer.
 *
 * Entries with level < _minLevel are discarded silently, even when _enabled.
 * Default is 2 (INFO) — TRACE and DEBUG are filtered unless the user lowers it.
 * Persisted to localStorage key 'inl_diagnostics_level'.
 */
let _minLevel: LogLevel = 2;
try {
  const stored = localStorage.getItem("inl_diagnostics_level");
  if (stored !== null) {
    const parsed = Number.parseInt(stored, 10);
    if (parsed >= 0 && parsed <= 4) _minLevel = parsed as LogLevel;
  }
} catch {
  // localStorage unavailable — use default
}

/** The in-memory circular log buffer — newest entries at the END */
let logEntries: LogEntry[] = [];

/** Monotonically increasing ID counter — never resets even after buffer trim */
let nextId = 0;

/**
 * listeners — callbacks registered by subscribers (DiagnosticsPanel).
 * Each listener is called synchronously after every successful append().
 */
const listeners: (() => void)[] = [];

/** Maps numeric level to human-readable name — used when creating entries */
const LEVEL_NAMES: LogLevelName[] = ["TRACE", "DEBUG", "INFO", "WARN", "ERROR"];

// ── Public control API ───────────────────────────────────────────────────────

/**
 * setDiagnosticsEnabled — updates the master gate.
 *
 * FLOW:
 *   UserPreferencesContext detects change → calls setDiagnosticsEnabled(bool)
 *   → updates _enabled → persists to localStorage
 *   → when disabling: clears buffer so stale entries don't appear on re-enable
 *
 * @param enabled - true to start logging, false to stop and clear buffer
 */
export function setDiagnosticsEnabled(enabled: boolean): void {
  const wasEnabled = _enabled;
  _enabled = enabled;

  // Clear buffer when disabling — stale entries would be confusing on re-enable
  if (wasEnabled && !enabled) {
    logEntries = [];
    nextId = 0;
    for (const l of listeners) l(); // notify panel to clear its display
  }

  try {
    localStorage.setItem("inl_diagnostics", String(enabled));
  } catch {
    // localStorage unavailable — ignore
  }
}

/**
 * setDiagnosticsLevel — sets the minimum log level filter.
 *
 * FLOW:
 *   UserPreferencesContext calls this after loading/saving preferences
 *   → updates _minLevel → persists to localStorage
 *   → existing buffer is NOT cleared (user can see older entries at new level)
 *
 * @param level - 0=TRACE, 1=DEBUG, 2=INFO (default), 3=WARN, 4=ERROR
 */
export function setDiagnosticsLevel(level: number): void {
  const clamped = Math.max(0, Math.min(4, Math.round(level))) as LogLevel;
  _minLevel = clamped;
  try {
    localStorage.setItem("inl_diagnostics_level", String(clamped));
  } catch {
    // localStorage unavailable — ignore
  }
}

/** Returns the current minimum level filter value */
export function getDiagnosticsLevel(): LogLevel {
  return _minLevel;
}

/**
 * subscribe — register a callback called after every new log entry.
 * Returns an unsubscribe function — call it in useEffect cleanup.
 *
 * FLOW:
 *   DiagnosticsPanel mounts
 *   → calls subscribe(callback)
 *   → callback updates panel state on every new entry
 *   → DiagnosticsPanel unmounts → calls returned unsubscribe()
 */
export function subscribe(listener: () => void): () => void {
  listeners.push(listener);
  return () => {
    const index = listeners.indexOf(listener);
    if (index !== -1) listeners.splice(index, 1);
  };
}

/**
 * getEntries — returns log entries in DESCENDING order (newest first).
 *
 * DiagnosticsPanel calls this after every subscribe notification.
 * The reverse() here means the panel shows newest entries at the TOP —
 * users see the most recent logs without scrolling to the bottom.
 *
 * NOTE: DiagnosticsPanel must NOT reverse again — getEntries already does it.
 */
export function getEntries(): LogEntry[] {
  return [...logEntries].reverse();
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
 * FLOW DIAGRAM:
 *   1. Check _enabled gate — return if false (ZERO overhead path)
 *   2. Check _minLevel gate — return if entry.level < _minLevel (filtered)
 *   3. Build LogEntry with id, timestamp, level, levelName, message, data
 *   4. Push to logEntries array
 *   5. Trim circular buffer if over MAX_ENTRIES
 *   6. Notify all subscribers synchronously
 *
 * VARIABLE INITIALIZATION:
 *   - entry.id = nextId++ (monotonically increasing, never resets)
 *   - entry.timestamp = now() (HH:MM:SS from current Date)
 *   - entry.levelName = LEVEL_NAMES[level] (e.g. "INFO" for level 2)
 *
 * @param level   - Numeric log level 0–4
 * @param message - Log message text
 * @param data    - Optional structured data (displayed expandable in panel)
 */
function append(level: LogLevel, message: string, data?: unknown): void {
  // ── GATE 1: zero-overhead when diagnostics is disabled ────────────────────
  // This MUST be the very first check — no allocations above this line.
  if (!_enabled) return;

  // ── GATE 2: level filter — discard entries below the minimum level ────────
  // Example: if _minLevel = 2 (INFO), TRACE (0) and DEBUG (1) are discarded.
  if (level < _minLevel) return;

  // ── BUILD ENTRY ───────────────────────────────────────────────────────────
  const entry: LogEntry = {
    id: nextId++, // unique, monotonically increasing
    timestamp: now(), // HH:MM:SS captured at log time
    level, // numeric 0–4
    levelName: LEVEL_NAMES[level], // "TRACE"|"DEBUG"|"INFO"|"WARN"|"ERROR"
    message, // the log message text
    ...(data !== undefined && { data }), // optional structured data
  };

  logEntries.push(entry);

  // ── CIRCULAR BUFFER: drop oldest entries when over the limit ──────────────
  if (logEntries.length > MAX_ENTRIES) {
    logEntries = logEntries.slice(logEntries.length - MAX_ENTRIES);
  }

  // ── NOTIFY SUBSCRIBERS ────────────────────────────────────────────────────
  // Called synchronously so the DiagnosticsPanel re-renders immediately.
  for (const l of listeners) l();
}

// ── Public numeric-level log functions ───────────────────────────────────────
//
// These are the primary API. Each is a thin wrapper around append().
// All gating (enabled + minLevel) happens inside append().

/**
 * log — generic log with explicit level.
 * Use when you need fine-grained control over which level to emit.
 *
 * @param level   - 0=TRACE, 1=DEBUG, 2=INFO, 3=WARN, 4=ERROR
 * @param message - Log message
 * @param data    - Optional structured data (shown expandable in panel)
 */
export function log(level: LogLevel, message: string, data?: unknown): void {
  append(level, message, data);
}

/**
 * logTrace — level 0 (TRACE).
 * Use for: variable initialization, fine-grained flow checkpoints.
 * Example: logTrace('Initialized profileKey', profileKey)
 */
export function logTrace(message: string, data?: unknown): void {
  append(0, message, data);
}

/**
 * logDebug — level 1 (DEBUG).
 * Use for: function entry, navigation events, role/permission checks.
 * Example: logDebug('Entering fetchProfiles', { actor: !!actor })
 */
export function logDebug(message: string, data?: unknown): void {
  append(1, message, data);
}

/**
 * logInfo — level 2 (INFO).
 * Use for: API calls and responses, successful operations.
 * Example: logInfo('getCustomers returned', { count: results.length })
 */
export function logInfo(message: string, data?: unknown): void {
  append(2, message, data);
}

/**
 * logWarn — level 3 (WARN).
 * Use for: unexpected empty results, permission denied, fallback to default.
 * Example: logWarn('getCustomers returned empty', { profileKey })
 */
export function logWarn(message: string, data?: unknown): void {
  append(3, message, data);
}

/**
 * logError — level 4 (ERROR).
 * Use for: caught exceptions, failed mutations, backend call failures.
 * Example: logError('createCustomer failed', error)
 */
export function logError(message: string, data?: unknown): void {
  append(4, message, data);
}

// ── Backward-compatibility aliases ──────────────────────────────────────────
//
// These preserve existing call sites that use the old named-level API.
// They map to numeric levels so the level filter works correctly.
//
//   logApi   → level 2 (INFO)  — backend actor call events
//   logNav   → level 1 (DEBUG) — route/navigation transitions
//   logAuth  → level 1 (DEBUG) — login / logout / role events

/**
 * logApi — backend actor call events (mapped to INFO = level 2).
 * Convention: "→ methodName" before call, "← methodName OK" after.
 * @deprecated Prefer logInfo() for new code. Kept for backward compatibility.
 */
export function logApi(message: string, data?: unknown): void {
  append(2, message, data);
}

/**
 * logNav — route/navigation transition events (mapped to DEBUG = level 1).
 * @deprecated Prefer logDebug() for new code. Kept for backward compatibility.
 */
export function logNav(message: string, data?: unknown): void {
  append(1, message, data);
}

/**
 * logAuth — authentication and role events (mapped to DEBUG = level 1).
 * @deprecated Prefer logDebug() for new code. Kept for backward compatibility.
 */
export function logAuth(message: string, data?: unknown): void {
  append(1, message, data);
}
