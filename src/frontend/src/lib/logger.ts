/**
 * logger.ts — A lightweight in-memory logger for the Diagnostics Panel.
 *
 * WHAT THIS FILE DOES:
 * Provides simple log functions that store entries in a circular buffer
 * (max 200 entries). The DiagnosticsPanel component subscribes to new entries
 * by polling this store every 500ms.
 *
 * LOG LEVELS:
 *   debug — general debug info (grey)
 *   api   — before/after backend actor calls (blue)
 *   error — caught exceptions (red)
 *   nav   — route transitions (green)
 *
 * IMPORTANT: This module has NO React or backend dependencies. It is safe to
 * import from any file including hooks, contexts, and utility modules.
 */

/** A single log entry */
export interface LogEntry {
  /** Monotonically increasing ID — used as React key */
  id: number;
  /** HH:MM:SS timestamp captured when the entry was created */
  timestamp: string;
  /** Log level — controls the colour in the Diagnostics Panel */
  level: "debug" | "api" | "error" | "nav";
  /** The log message string */
  message: string;
}

/** Maximum number of entries retained in memory (circular buffer) */
const MAX_ENTRIES = 200;

/** The in-memory log store — all entries */
let logEntries: LogEntry[] = [];
/** Monotonically increasing ID counter */
let nextId = 0;
/** All subscribed listeners (DiagnosticsPanel registers one listener) */
const listeners: (() => void)[] = [];

/**
 * subscribe — register a callback that is called whenever a new log entry
 * is appended. Returns an unsubscribe function.
 */
export function subscribe(listener: () => void): () => void {
  listeners.push(listener);
  return () => {
    const index = listeners.indexOf(listener);
    if (index !== -1) listeners.splice(index, 1);
  };
}

/**
 * getEntries — returns a copy of all current log entries.
 * The DiagnosticsPanel calls this to render the list.
 */
export function getEntries(): LogEntry[] {
  return [...logEntries];
}

/** Format the current time as HH:MM:SS for the timestamp column */
function now(): string {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

/** Internal — appends a new entry and notifies all listeners */
function append(level: LogEntry["level"], message: string): void {
  const entry: LogEntry = { id: nextId++, timestamp: now(), level, message };
  logEntries.push(entry);
  // Circular buffer: remove oldest entry when over the limit
  if (logEntries.length > MAX_ENTRIES) {
    logEntries = logEntries.slice(logEntries.length - MAX_ENTRIES);
  }
  // Notify all subscribers synchronously
  for (const l of listeners) l();
}

/** Log a general debug message */
export function logDebug(message: string): void {
  append("debug", message);
}

/** Log an API / backend call event (before/after actor calls) */
export function logApi(message: string): void {
  append("api", message);
}

/** Log an error (caught exception or failed backend call) */
export function logError(message: string): void {
  append("error", message);
}

/** Log a navigation/route transition event */
export function logNav(message: string): void {
  append("nav", message);
}
