/**
 * DiagnosticsPanel.tsx — A fixed bottom overlay that shows real-time debug logs.
 *
 * WHAT THIS FILE DOES:
 * Renders a collapsible dark console panel pinned to the bottom of the screen.
 * It is ONLY visible when `diagnosticsEnabled` is true in UserPreferencesContext.
 *
 * HOW IT WORKS:
 * - Subscribes to the logger store (lib/logger.ts) using the subscribe() API.
 * - Re-renders whenever a new log entry arrives.
 * - Displays up to 200 entries in a scrollable, monospace window.
 * - Each entry shows: [HH:MM:SS] [LEVEL] message
 * - Colour-coded by level: api=blue, error=red, nav=green, debug=grey
 * - The panel can be minimized (collapses to just the header bar) or fully closed
 *   (which disables diagnostics via the context setter).
 *
 * WHO USES THIS:
 *   Layout.tsx — renders this at the bottom of the layout when diagnostics is on
 */

import { useUserPreferences } from "@/contexts/UserPreferencesContext";
import { getEntries, subscribe } from "@/lib/logger";
import type { LogEntry } from "@/lib/logger";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/** Colour mapping per log level */
const LEVEL_COLORS: Record<LogEntry["level"], string> = {
  api: "text-blue-400",
  error: "text-red-400",
  nav: "text-emerald-400",
  debug: "text-zinc-400",
};

/** Badge label shown in brackets before the message */
const LEVEL_LABELS: Record<LogEntry["level"], string> = {
  api: "API",
  error: "ERR",
  nav: "NAV",
  debug: "DBG",
};

/**
 * DiagnosticsPanel — fixed bottom overlay showing real-time log entries.
 * Only rendered when `diagnosticsEnabled === true` in UserPreferencesContext.
 */
export function DiagnosticsPanel() {
  const { diagnosticsEnabled, setDiagnosticsEnabled } = useUserPreferences();
  const [entries, setEntries] = useState<LogEntry[]>(getEntries);
  const [minimized, setMinimized] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Track whether the user has manually scrolled up (to stop auto-scroll)
  const autoScrollRef = useRef(true);

  // Subscribe to new log entries
  useEffect(() => {
    const unsubscribe = subscribe(() => {
      setEntries(getEntries());
    });
    return unsubscribe;
  }, []);

  // Auto-scroll to bottom when new entries arrive (unless user has scrolled up)
  // We intentionally omit `entries` from deps — we want this to fire after
  // the subscribe callback sets state, not on initial render.
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional scroll-on-update
  useEffect(() => {
    if (autoScrollRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries]);

  // Don't render at all if diagnostics is disabled
  if (!diagnosticsEnabled) return null;

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    // If the user is within 40px of the bottom, re-enable auto-scroll
    autoScrollRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  };

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-700 bg-zinc-950 text-xs font-mono shadow-2xl"
      style={{ maxHeight: minimized ? "36px" : "220px" }}
      data-ocid="diagnostics.panel"
    >
      {/* ── Panel header bar ── */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900 border-b border-zinc-800 select-none">
        <div className="flex items-center gap-2">
          {/* Coloured status dot */}
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-zinc-300 font-semibold tracking-wide text-[11px]">
            DIAGNOSTICS
          </span>
          <span className="text-zinc-500 text-[10px]">
            ({entries.length} entries)
          </span>
        </div>

        <div className="flex items-center gap-1">
          {/* Minimize / expand toggle */}
          <button
            type="button"
            onClick={() => setMinimized((v) => !v)}
            className="p-1 rounded hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors"
            aria-label={
              minimized ? "Expand diagnostics" : "Minimize diagnostics"
            }
            data-ocid="diagnostics.toggle_button"
          >
            {minimized ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
          {/* Close button — disables diagnostics entirely */}
          <button
            type="button"
            onClick={() => setDiagnosticsEnabled(false)}
            className="p-1 rounded hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors"
            aria-label="Close diagnostics panel"
            data-ocid="diagnostics.close_button"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── Log entries list (hidden when minimized) ── */}
      {!minimized && (
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="overflow-y-auto"
          style={{ maxHeight: "184px" }}
          data-ocid="diagnostics.log_list"
        >
          {entries.length === 0 ? (
            <p className="px-3 py-2 text-zinc-600 italic">
              No log entries yet. Interact with the app to see backend calls and
              navigation events here.
            </p>
          ) : (
            entries.map((entry) => (
              <div
                key={entry.id}
                className={cn(
                  "flex gap-2 px-3 py-0.5 hover:bg-zinc-900/60 leading-5",
                  LEVEL_COLORS[entry.level],
                )}
              >
                {/* Timestamp */}
                <span className="text-zinc-600 shrink-0">
                  [{entry.timestamp}]
                </span>
                {/* Level badge */}
                <span
                  className={cn(
                    "shrink-0 font-bold",
                    LEVEL_COLORS[entry.level],
                  )}
                >
                  [{LEVEL_LABELS[entry.level]}]
                </span>
                {/* Message — allow wrapping for long payloads */}
                <span className="break-all">{entry.message}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
