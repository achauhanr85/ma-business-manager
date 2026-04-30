/**
 * DiagnosticsPanel.tsx — Resizable fixed-bottom overlay showing real-time debug logs.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT THIS FILE DOES
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Renders a collapsible, user-resizable dark console panel pinned to the
 * bottom of the screen. It is ONLY rendered when `diagnosticsEnabled` is true
 * in UserPreferencesContext.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * RESIZE LOGIC
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The panel height is driven by a `panelHeight` state value (pixels). The top
 * edge of the panel has a drag handle — a narrow strip with `cursor: ns-resize`.
 *
 * Resize flow:
 *   1. User presses mousedown on the drag handle
 *      → we record the starting Y position (`dragStartY`) and the starting
 *        panel height (`dragStartHeight`) in refs, then set `isDragging = true`.
 *
 *   2. A `mousemove` listener is attached to `document` (not just the handle)
 *      so the drag continues even if the cursor moves away quickly.
 *      → delta = dragStartY - e.clientY  (positive when dragging up = taller)
 *      → newHeight = clamp(dragStartHeight + delta, MIN_HEIGHT, MAX_HEIGHT)
 *
 *   3. User releases mousebutton → `mouseup` listener sets `isDragging = false`
 *      and persists the final height to localStorage.
 *
 * Why we use refs for dragStartY and dragStartHeight:
 *   These values only change at drag-start. If we used state, React would
 *   re-render on every mousemove, which is unnecessary and causes flicker.
 *   Refs give us stable values across the closure without triggering renders.
 *
 * Why `user-select: none` during drag:
 *   Without it, the browser selects text in the log entries as the user drags,
 *   which looks broken and breaks the drag UX.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * HEIGHT PERSISTENCE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The panel height is saved to `localStorage` (key: `diagnostics-panel-height`)
 * whenever the user finishes a drag. On mount, we restore the saved height.
 * This means the panel "remembers" its size across page refreshes.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * MINIMIZE / CLOSE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Minimize: collapses the panel to just the title bar (~40px). The drag handle
 * is hidden when minimized — there's nothing to resize. The saved panelHeight is
 * preserved so the panel restores to its last height when expanded again.
 *
 * Close: calls `setDiagnosticsEnabled(false)` from UserPreferencesContext.
 * This hides the panel and disables the logger gate so zero overhead remains.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHO USES THIS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   Layout.tsx — renders <DiagnosticsPanel /> at the bottom of the layout
 *                when diagnosticsEnabled is true.
 */

import { useUserPreferences } from "@/contexts/UserPreferencesContext";
import { getEntries, subscribe } from "@/lib/logger";
import type { LogEntry } from "@/lib/logger";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

// ── Constants ────────────────────────────────────────────────────────────────

/** Smallest the panel can be while still showing some log entries */
const MIN_HEIGHT = 80;

/**
 * Largest the panel can be — 60% of viewport height.
 * We compute this dynamically so it adapts if the user resizes their browser window.
 */
function getMaxHeight(): number {
  return Math.floor(window.innerHeight * 0.6);
}

/** localStorage key for persisting the panel height between sessions */
const STORAGE_KEY = "diagnostics-panel-height";

/** Default height in pixels when no saved value exists */
const DEFAULT_HEIGHT = 220;

/** Height of the title bar when minimized (title bar only, no log entries) */
const MINIMIZED_HEIGHT = 40;

// ── Colour / label maps ───────────────────────────────────────────────────────

/** Tailwind text colour class per log level */
const LEVEL_COLORS: Record<LogEntry["level"], string> = {
  api: "text-blue-400",
  error: "text-red-400",
  nav: "text-emerald-400",
  debug: "text-zinc-400",
  auth: "text-purple-400",
};

/** Short badge text shown in brackets before each message */
const LEVEL_LABELS: Record<LogEntry["level"], string> = {
  api: "API",
  error: "ERR",
  nav: "NAV",
  debug: "DBG",
  auth: "AUTH",
};

// ── Component ────────────────────────────────────────────────────────────────

/**
 * DiagnosticsPanel — fixed bottom overlay showing real-time log entries.
 *
 * Rendered (and subscribes to logger) ONLY when `diagnosticsEnabled === true`.
 * The panel is resizable by dragging the top edge handle.
 */
export function DiagnosticsPanel() {
  const { diagnosticsEnabled, setDiagnosticsEnabled } = useUserPreferences();

  // ── Log entry state ────────────────────────────────────────────────────────
  const [entries, setEntries] = useState<LogEntry[]>(getEntries);

  // ── Panel height state ─────────────────────────────────────────────────────
  // Initialise from localStorage — restore the user's last preferred height.
  const [panelHeight, setPanelHeight] = useState<number>(() => {
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
  // Stored as refs (not state) so mousemove handler can read them without
  // needing to be recreated on every render — avoids rapid state churn.

  /** Y coordinate of the pointer when the drag started */
  const dragStartY = useRef(0);
  /** Panel height at the moment the drag started */
  const dragStartHeight = useRef(DEFAULT_HEIGHT);

  // ── Scroll tracking ref ───────────────────────────────────────────────────
  const scrollRef = useRef<HTMLDivElement>(null);
  /** true while the user is near the bottom — auto-scroll follows new entries */
  const autoScrollRef = useRef(true);

  // ── Subscribe to logger ───────────────────────────────────────────────────
  useEffect(() => {
    const unsubscribe = subscribe(() => {
      setEntries(getEntries());
    });
    return unsubscribe;
  }, []);

  // ── Auto-scroll to bottom when new entries arrive ─────────────────────────
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional
  useEffect(() => {
    if (autoScrollRef.current && scrollRef.current && !minimized) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries]);

  // ── Resize: mousedown on drag handle ─────────────────────────────────────
  /**
   * handleDragStart — called when the user presses the mouse on the drag handle.
   *
   * Records the starting state into refs (not state — no re-render needed)
   * and sets the dragging flag so the panel applies `user-select: none`.
   */
  const handleDragStart = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // Ignore if the panel is minimized — the handle is hidden anyway, but
      // this is a safety guard in case the event fires unexpectedly.
      if (minimized) return;

      e.preventDefault(); // prevent text selection on the drag-start click

      dragStartY.current = e.clientY;
      dragStartHeight.current = panelHeight;
      setIsDragging(true);
    },
    [minimized, panelHeight],
  );

  // ── Resize: mousemove and mouseup attached to document ───────────────────
  /**
   * WHY document-level listeners:
   *   If the user moves the mouse faster than the browser can fire events on
   *   the small handle element, the cursor leaves the handle and the drag stops.
   *   Attaching to `document` means the drag continues as long as the button
   *   is held, regardless of where the cursor is on screen.
   *
   * WHY effect depends on isDragging:
   *   We add listeners only while dragging and remove them immediately on mouseup.
   *   This is the standard pattern — avoids a permanent document-level listener
   *   that runs on every mouse move across the entire app.
   */
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      // delta > 0 means cursor moved UP → user wants the panel to be TALLER
      const delta = dragStartY.current - e.clientY;
      const newHeight = Math.max(
        MIN_HEIGHT,
        Math.min(getMaxHeight(), dragStartHeight.current + delta),
      );
      setPanelHeight(newHeight);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      // Persist the final height to localStorage so it survives a page refresh
      try {
        localStorage.setItem(STORAGE_KEY, String(panelHeight));
      } catch {
        // localStorage unavailable — ignore
      }
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    // Cleanup: always remove both listeners when the effect re-runs or unmounts.
    // Without this, stale listeners accumulate and drag stops working correctly.
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, panelHeight]);

  // ── Persist height when dragging stops ───────────────────────────────────
  // We write to localStorage in the mouseup handler above via the effect.
  // This secondary effect catches the case where panelHeight changes via
  // the state setter in handleMouseMove (stores the final value on drag end).
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
    // Re-enable auto-scroll when the user scrolls back near the bottom
    autoScrollRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  };

  // ── Early return — do not render if diagnostics is disabled ───────────────
  if (!diagnosticsEnabled) return null;

  // ── Computed panel height ─────────────────────────────────────────────────
  // When minimized: only the title bar (MINIMIZED_HEIGHT).
  // When expanded: the user-controlled panelHeight.
  const currentHeight = minimized ? MINIMIZED_HEIGHT : panelHeight;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-700 bg-zinc-950 text-xs font-mono shadow-2xl flex flex-col"
      style={{
        height: `${currentHeight}px`,
        // Disable text selection while dragging so the browser doesn't
        // highlight log entries as the user moves the mouse up/down.
        userSelect: isDragging ? "none" : "auto",
      }}
      data-ocid="diagnostics.panel"
    >
      {/* ── Drag Handle — only shown when not minimized ─────────────────── */}
      {/* This strip is the resize target. Its cursor and visual appearance
          communicate that it is draggable. Hidden when minimized because
          there's nothing useful to resize to. */}
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
          aria-hidden="true" // decorative — not keyboard-accessible
        >
          {/* Three dots visual affordance — commonly used for drag handles */}
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
          {/* Green pulse dot — indicates the panel is live and receiving logs */}
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
          <span className="text-zinc-300 font-semibold tracking-wide text-[11px]">
            DIAGNOSTICS
          </span>
          <span className="text-zinc-500 text-[10px]">
            ({entries.length} entries)
          </span>
          {/* Dragging indicator — lets the user know a resize is in progress */}
          {isDragging && (
            <span className="text-amber-400 text-[10px]">↕ resizing…</span>
          )}
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
          {/* Close — disables diagnostics entirely via context */}
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
            entries.map((entry) => (
              <div
                key={entry.id}
                className={cn(
                  "flex gap-2 px-3 py-0.5 hover:bg-zinc-900/60 leading-5",
                  LEVEL_COLORS[entry.level],
                )}
              >
                {/* Timestamp column */}
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
                {/* Message — break-all prevents long function names from overflowing */}
                <span className="break-all">{entry.message}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
