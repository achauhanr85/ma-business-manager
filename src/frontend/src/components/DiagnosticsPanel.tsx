/**
 * DiagnosticsPanel.tsx — Resizable fixed-bottom overlay showing real-time debug logs.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * PAGE FLOW
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * RENDER GATE:
 *   diagnosticsEnabled === false → return null (no render, no subscription)
 *   diagnosticsEnabled === true  → render panel + subscribe to logger
 *
 * LOG DISPLAY FLOW:
 *   1. On mount: subscribe(() => setEntries(getEntries()))
 *   2. logger.append() fires → listener called → setEntries(getEntries())
 *   3. getEntries() returns entries in DESCENDING order (newest first)
 *   4. Panel renders newest entries at top — no manual reverse needed
 *
 * RESIZE FLOW:
 *   1. User presses mousedown on drag handle
 *      → record dragStartY + dragStartHeight in refs, set isDragging = true
 *   2. mousemove on document (attached only while dragging)
 *      → delta = dragStartY - e.clientY (positive = cursor moved UP = taller)
 *      → newHeight = clamp(dragStartHeight + delta, MIN_HEIGHT, MAX_HEIGHT)
 *   3. mouseup on document
 *      → setIsDragging(false) → persist final height to localStorage
 *
 * MINIMIZE / CLOSE FLOW:
 *   - Minimize: collapse to MINIMIZED_HEIGHT (title bar only), drag handle hidden
 *   - Expand:   restore to saved panelHeight
 *   - Close:    calls setDiagnosticsEnabled(false) → panel disappears + logger gated
 *
 * HEIGHT PERSISTENCE:
 *   - Saved to localStorage key 'diagnostics-panel-height' on drag end
 *   - Restored from localStorage on mount
 *
 * LEVEL BADGE DISPLAY:
 *   TRACE: gray background + gray text
 *   DEBUG: blue background + white text
 *   INFO:  green background + white text
 *   WARN:  yellow/amber background + dark text
 *   ERROR: red background + white text
 *
 * WHO USES THIS:
 *   Layout.tsx — renders <DiagnosticsPanel /> at the bottom when diagnosticsEnabled
 */

import { useUserPreferences } from "@/contexts/UserPreferencesContext";
import { getDiagnosticsLevel, getEntries, subscribe } from "@/lib/logger";
import { logDebug } from "@/lib/logger";
import type { LogEntry } from "@/lib/logger";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

// ── Constants ────────────────────────────────────────────────────────────────

/** Smallest panel height while still showing some log entries */
const MIN_HEIGHT = 80;

/** Max height: 60% of viewport, computed dynamically for window resize */
function getMaxHeight(): number {
  return Math.floor(window.innerHeight * 0.6);
}

/** localStorage key for persisting the panel height between sessions */
const STORAGE_KEY = "diagnostics-panel-height";

/** Default height in pixels when no saved value exists */
const DEFAULT_HEIGHT = 220;

/** Height of the title bar when minimized (no log entries visible) */
const MINIMIZED_HEIGHT = 40;

// ── Level badge styles ────────────────────────────────────────────────────────
//
// Each level gets a distinct background + text colour for instant visual scanning.
// Tailwind classes are used directly (no dynamic string concatenation — avoids
// purge issues with class names that aren't statically analysable).

interface LevelStyle {
  /** Tailwind classes for the badge pill */
  badge: string;
  /** Tailwind class for the row text colour */
  row: string;
}

/**
 * LEVEL_STYLES — colour scheme for each numeric log level.
 * Applied to both the level badge and the overall row text.
 *
 * VARIABLE INITIALIZATION:
 *   - Index 0 = TRACE (gray)
 *   - Index 1 = DEBUG (blue)
 *   - Index 2 = INFO  (green)
 *   - Index 3 = WARN  (amber)
 *   - Index 4 = ERROR (red)
 */
const LEVEL_STYLES: LevelStyle[] = [
  // 0 = TRACE
  { badge: "bg-zinc-700 text-zinc-300", row: "text-zinc-500" },
  // 1 = DEBUG
  { badge: "bg-blue-700 text-white", row: "text-blue-400" },
  // 2 = INFO
  { badge: "bg-emerald-700 text-white", row: "text-emerald-400" },
  // 3 = WARN
  { badge: "bg-amber-500 text-zinc-900", row: "text-amber-400" },
  // 4 = ERROR
  { badge: "bg-red-700 text-white", row: "text-red-400" },
];

/** Name of each level as shown in the badge (already in LogEntry.levelName) */
const LEVEL_NAMES = ["TRACE", "DEBUG", "INFO", "WARN", "ERROR"] as const;

// ── Component ────────────────────────────────────────────────────────────────

/**
 * DiagnosticsPanel — fixed bottom overlay showing real-time log entries.
 *
 * PAGE FLOW SUMMARY:
 *   Mount → subscribe to logger → render entries (newest first)
 *   Drag handle → resize → persist height
 *   Minimize button → collapse to title bar
 *   Close button → disable diagnostics entirely
 *   Click entry → expand/collapse data payload
 */
export function DiagnosticsPanel() {
  const { diagnosticsEnabled, setDiagnosticsEnabled } = useUserPreferences();

  // ── Log entry state ────────────────────────────────────────────────────────
  // Initialized from getEntries() so the panel shows any pre-existing entries
  const [entries, setEntries] = useState<LogEntry[]>(getEntries);

  // ── Currently expanded entry (for data payload display) ───────────────────
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // ── Panel height state ─────────────────────────────────────────────────────
  // Restored from localStorage on mount so the panel remembers its last size
  const [panelHeight, setPanelHeight] = useState<number>(() => {
    // TRACE: variable initialization — panelHeight from localStorage
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = Number.parseInt(saved, 10);
        if (!Number.isNaN(parsed)) return Math.max(MIN_HEIGHT, parsed);
      }
    } catch {
      // localStorage unavailable
    }
    return DEFAULT_HEIGHT;
  });

  // Whether the panel is collapsed to just the title bar
  const [minimized, setMinimized] = useState(false);

  // Whether the user is currently dragging the resize handle
  const [isDragging, setIsDragging] = useState(false);

  // ── Drag state refs ────────────────────────────────────────────────────────
  // Refs (not state) so mousemove handler reads stable values across closures
  // without triggering re-renders on every mouse move.
  const dragStartY = useRef(0); // pointer Y at drag start
  const dragStartHeight = useRef(DEFAULT_HEIGHT); // panel height at drag start

  // ── Scroll tracking ───────────────────────────────────────────────────────
  const scrollRef = useRef<HTMLDivElement>(null);
  // true while user is near the bottom → auto-scroll follows new entries
  const autoScrollRef = useRef(true);

  // ── Subscribe to logger ───────────────────────────────────────────────────
  //
  // FLOW:
  //   mount → subscribe callback registered
  //   logger.append() → callback fires → setEntries(getEntries())
  //   getEntries() returns entries NEWEST FIRST (reversed in logger.ts)
  //   unmount → unsubscribe called
  useEffect(() => {
    logDebug("DiagnosticsPanel mounted, subscribing to logger");
    const unsubscribe = subscribe(() => {
      setEntries(getEntries());
    });
    return () => {
      logDebug("DiagnosticsPanel unmounting, unsubscribing from logger");
      unsubscribe();
    };
  }, []);

  // ── Auto-scroll to top when new entries arrive (newest = top) ────────────
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional scroll
  useEffect(() => {
    if (autoScrollRef.current && scrollRef.current && !minimized) {
      scrollRef.current.scrollTop = 0; // scroll to top since newest entries are at top
    }
  }, [entries]);

  // ── Resize: mousedown on drag handle ─────────────────────────────────────
  //
  // FLOW:
  //   mousedown → record start state in refs → setIsDragging(true)
  //   (does NOT setState on every move — only refs change during drag)
  const handleDragStart = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // Safety guard — handle is hidden when minimized but guard anyway
      if (minimized) return;
      e.preventDefault();

      // Record starting state into refs (no re-render needed)
      dragStartY.current = e.clientY;
      dragStartHeight.current = panelHeight;
      setIsDragging(true);
      logDebug("DiagnosticsPanel resize started", {
        startY: e.clientY,
        startHeight: panelHeight,
      });
    },
    [minimized, panelHeight],
  );

  // ── Resize: mousemove + mouseup on document ───────────────────────────────
  //
  // WHY document-level: cursor can leave the handle element if moved quickly.
  // Attaching to document keeps the drag alive regardless of cursor position.
  //
  // WHY effect depends on isDragging: listeners added only while dragging,
  // removed immediately on mouseup. No permanent document-level listener.
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      // delta > 0 = cursor moved UP = user wants a TALLER panel
      const delta = dragStartY.current - e.clientY;
      const newHeight = Math.max(
        MIN_HEIGHT,
        Math.min(getMaxHeight(), dragStartHeight.current + delta),
      );
      setPanelHeight(newHeight);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      logDebug("DiagnosticsPanel resize ended", { finalHeight: panelHeight });
      try {
        localStorage.setItem(STORAGE_KEY, String(panelHeight));
      } catch {
        // localStorage unavailable — ignore
      }
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, panelHeight]);

  // ── Persist height when drag ends ────────────────────────────────────────
  useEffect(() => {
    if (!isDragging) {
      try {
        localStorage.setItem(STORAGE_KEY, String(panelHeight));
      } catch {
        // ignore
      }
    }
  }, [isDragging, panelHeight]);

  // ── Scroll handler ────────────────────────────────────────────────────────
  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    // Re-enable auto-scroll when user scrolls near the top (since newest = top)
    autoScrollRef.current = el.scrollTop < 40;
  };

  // ── Toggle entry expansion (to show data payload) ────────────────────────
  const handleToggleExpand = (id: number) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  // ── Early return — do not render if diagnostics is disabled ───────────────
  if (!diagnosticsEnabled) return null;

  // ── Computed values ───────────────────────────────────────────────────────
  const currentHeight = minimized ? MINIMIZED_HEIGHT : panelHeight;
  // Current min level name for the panel title bar
  const minLevelName = LEVEL_NAMES[getDiagnosticsLevel()] ?? "INFO";

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-700 bg-zinc-950 text-xs font-mono shadow-2xl flex flex-col"
      style={{
        height: `${currentHeight}px`,
        // Disable text selection while dragging to prevent browser from
        // highlighting log entries as the user moves the mouse up/down.
        userSelect: isDragging ? "none" : "auto",
      }}
      data-ocid="diagnostics.panel"
    >
      {/* ── Drag Handle — only shown when not minimized ─────────────────── */}
      {!minimized && (
        <div
          className={cn(
            "w-full flex-shrink-0 flex items-center justify-center",
            "bg-zinc-800 hover:bg-zinc-700 transition-colors",
            "cursor-ns-resize select-none",
          )}
          style={{ height: "8px" }}
          onMouseDown={handleDragStart}
          title="Drag to resize panel"
          data-ocid="diagnostics.resize_handle"
          aria-hidden="true"
        >
          {/* Visual affordance — three horizontal bars */}
          <div className="flex gap-0.5">
            <span className="w-4 h-0.5 rounded bg-zinc-600" />
            <span className="w-4 h-0.5 rounded bg-zinc-600" />
            <span className="w-4 h-0.5 rounded bg-zinc-600" />
          </div>
        </div>
      )}

      {/* ── Panel Header Bar ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900 border-b border-zinc-800 select-none flex-shrink-0">
        <div className="flex items-center gap-2">
          {/* Live indicator dot */}
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
          <span className="text-zinc-300 font-semibold tracking-wide text-[11px]">
            DIAGNOSTICS
          </span>
          {/* Level filter indicator — shows minimum level in title */}
          <span className="text-zinc-500 text-[10px]">
            — {minLevelName} and above
          </span>
          <span className="text-zinc-600 text-[10px]">
            ({entries.length} entries)
          </span>
          {isDragging && (
            <span className="text-amber-400 text-[10px]">↕ resizing…</span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* Minimize / expand toggle */}
          <button
            type="button"
            onClick={() => {
              const next = !minimized;
              setMinimized(next);
              logDebug(`DiagnosticsPanel ${next ? "minimized" : "expanded"}`);
            }}
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
          {/* Close — disables diagnostics entirely */}
          <button
            type="button"
            onClick={() => {
              logDebug("DiagnosticsPanel closed by user");
              setDiagnosticsEnabled(false);
            }}
            className="p-1 rounded hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors"
            aria-label="Close diagnostics panel"
            data-ocid="diagnostics.close_button"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── Log Entries List — hidden when minimized ─────────────────────── */}
      {!minimized && (
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="overflow-y-auto flex-1 min-h-0"
          data-ocid="diagnostics.log_list"
        >
          {entries.length === 0 ? (
            <p className="px-3 py-2 text-zinc-600 italic">
              No log entries yet. Interact with the app to see backend calls and
              navigation events here.
            </p>
          ) : (
            entries.map((entry) => {
              // Safe level index with bounds guard
              const lvl = Math.max(0, Math.min(4, entry.level)) as
                | 0
                | 1
                | 2
                | 3
                | 4;
              const style = LEVEL_STYLES[lvl];
              const hasData = entry.data !== undefined;
              const isExpanded = expandedId === entry.id;

              return (
                <div
                  key={entry.id}
                  className={cn(
                    "flex flex-col px-3 py-0.5 hover:bg-zinc-900/60 leading-5 border-b border-zinc-900/50",
                    style.row,
                    hasData && "cursor-pointer",
                  )}
                  onClick={
                    hasData ? () => handleToggleExpand(entry.id) : undefined
                  }
                  onKeyUp={
                    hasData
                      ? (e) => e.key === "Enter" && handleToggleExpand(entry.id)
                      : undefined
                  }
                  data-ocid={`diagnostics.log_entry.${entry.id}`}
                >
                  {/* ── Entry header row: timestamp + badge + message ── */}
                  <div className="flex gap-2 items-start">
                    {/* Timestamp column — fixed width for alignment */}
                    <span className="text-zinc-600 shrink-0 w-[58px]">
                      [{entry.timestamp}]
                    </span>

                    {/* Level badge — colour-coded pill with level name */}
                    <span
                      className={cn(
                        "shrink-0 rounded px-1 py-0 text-[9px] font-bold leading-4 w-[38px] text-center",
                        style.badge,
                      )}
                    >
                      {entry.levelName ?? LEVEL_NAMES[lvl]}
                    </span>

                    {/* Message text — break-all prevents overflow on long strings */}
                    <span className="break-all flex-1">{entry.message}</span>

                    {/* Expand hint — shown only if entry has data */}
                    {hasData && (
                      <span className="text-zinc-600 shrink-0 text-[9px]">
                        {isExpanded ? "▲" : "▼"}
                      </span>
                    )}
                  </div>

                  {/* ── Expandable data payload ── */}
                  {isExpanded && hasData && (
                    <div className="mt-1 ml-[100px] text-zinc-400 bg-zinc-900 rounded px-2 py-1 overflow-x-auto">
                      <pre className="text-[10px] whitespace-pre-wrap break-all">
                        {JSON.stringify(entry.data, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
