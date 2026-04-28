/**
 * useAuth.ts — Authentication hook wrapping Internet Identity.
 *
 * WHAT THIS FILE DOES:
 * Provides a simple, consistent interface for checking login state and
 * triggering login/logout in any component. It wraps the Caffeine
 * `useInternetIdentity` hook to expose only the fields our app uses,
 * with friendly names (e.g. `isLoading` instead of `isInitializing`).
 *
 * WHO USES THIS:
 *   App.tsx — to check `isAuthenticated` and decide which screen to show
 *   PendingApprovalGate, ProfilePendingApprovalGate — to call `logout()`
 *   Sidebar.tsx — to call `logout()` from the logout button
 */

import { useInternetIdentity } from "@caffeineai/core-infrastructure";

/**
 * useAuth — returns the current auth state and login/logout helpers.
 *
 * @returns identity      - The Internet Identity object (contains the user's principal)
 * @returns isAuthenticated - true once login is complete and identity is available
 * @returns isLoading     - true while Internet Identity SDK is still initialising
 * @returns loginStatus   - raw SDK status string (e.g. "logged-in", "logging-in")
 * @returns login         - function to open the Internet Identity login flow
 * @returns logout        - function to clear the identity and end the session
 */
export function useAuth() {
  const {
    identity,
    loginStatus,
    login,
    clear, // `clear` = the SDK's name for logging out
    isAuthenticated,
    isInitializing, // true while the SDK is checking for an existing session
  } = useInternetIdentity();

  return {
    identity,
    isAuthenticated,
    // Rename `isInitializing` to `isLoading` so callers use consistent terminology
    isLoading: isInitializing,
    loginStatus,
    login,
    // Rename `clear` to `logout` for readability
    logout: clear,
  };
}
