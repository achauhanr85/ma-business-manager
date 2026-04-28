/**
 * main.tsx — Application entry point.
 *
 * WHAT THIS FILE DOES:
 * This is the very first file React runs. It:
 *   1. Creates a QueryClient for React Query (caches backend data)
 *   2. Wraps the app in required providers (QueryClientProvider, InternetIdentityProvider)
 *   3. Mounts the <App /> component into the DOM's #root element
 *
 * WHY THE BigInt.prototype.toJSON PATCH:
 * The Internet Computer backend returns BigInt values (e.g. for IDs, timestamps,
 * quantities). JavaScript's `JSON.stringify()` throws an error for BigInt by default.
 * This patch makes BigInts serialize as their string representation instead,
 * which prevents crashes when React Query tries to cache or log backend responses.
 *
 * PROVIDER SETUP:
 *   QueryClientProvider — enables React Query's `useQuery` and `useMutation` hooks
 *     throughout the app. `staleTime: 30_000` means cached data is considered fresh
 *     for 30 seconds before re-fetching. `retry: 1` means failed requests are retried once.
 *   InternetIdentityProvider — enables Internet Identity authentication. Wrapping at
 *     the root means every component can call `useInternetIdentity()`.
 *
 * This file should be kept minimal — no business logic, no components.
 */

import { InternetIdentityProvider } from "@caffeineai/core-infrastructure";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// ── BigInt JSON serialization patch ──────────────────────────────────────────
// BigInts from the IC backend are not natively serializable to JSON.
// This patch converts them to strings when JSON.stringify is called,
// preventing "TypeError: Do not know how to serialize a BigInt" errors.
BigInt.prototype.toJSON = function () {
  return this.toString();
};

// TypeScript declaration to satisfy the compiler about the patch above
declare global {
  interface BigInt {
    toJSON(): string;
  }
}

// ── React Query client ────────────────────────────────────────────────────────
// Shared instance used by all `useQuery` and `useMutation` calls in the app.
// Created once here and provided via QueryClientProvider below.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data is considered fresh for 30 seconds — prevents over-fetching on
      // pages that re-render frequently
      staleTime: 30_000,
      // Retry once on failure — catches transient network hiccups without spamming the backend
      retry: 1,
    },
  },
});

// ── Mount the app ─────────────────────────────────────────────────────────────
// `document.getElementById("root")!` — the `!` asserts the element exists.
// The actual <div id="root"> is in index.html in the project root.
ReactDOM.createRoot(document.getElementById("root")!).render(
  // QueryClientProvider — makes the queryClient available to all child components
  <QueryClientProvider client={queryClient}>
    {/* InternetIdentityProvider — enables authentication via Internet Identity.
        All useInternetIdentity() calls inside <App /> read from this context. */}
    <InternetIdentityProvider>
      <App />
    </InternetIdentityProvider>
  </QueryClientProvider>,
);
