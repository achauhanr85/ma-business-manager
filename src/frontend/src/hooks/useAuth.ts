/**
 * useAuth.ts — Authentication hook wrapping Internet Identity.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * PAGE FLOW
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * INITIALIZATION FLOW:
 *   1. Component mounts → useAuth() called
 *   2. useInternetIdentity() checks for existing II session
 *      → isInitializing = true while SDK checks
 *      → isInitializing = false after check completes
 *   3. If session found: isAuthenticated = true, identity set
 *   4. If no session: isAuthenticated = false
 *
 * LOGIN FLOW:
 *   1. User clicks Login button → login() called
 *   2. loginStatus transitions: "idle" → "logging-in" → "logged-in"
 *   3. identity set → isAuthenticated becomes true
 *   4. App.tsx routing re-evaluates and shows authenticated view
 *
 * LOGOUT FLOW:
 *   1. User clicks Logout → logout() called (alias for clear())
 *   2. II session cleared
 *   3. isAuthenticated becomes false
 *   4. App.tsx shows login/public view
 *
 * DIAGNOSTIC LOGGING:
 *   - DEBUG (1): function entry and loginStatus changes
 *   - INFO  (2): successful login / logout completion
 *   - ERROR (4): login/logout failures
 *
 * WHO USES THIS:
 *   App.tsx — to check isAuthenticated and decide which screen to show
 *   PendingApprovalGate, ProfilePendingApprovalGate — to call logout()
 *   Sidebar.tsx — to call logout() from the logout button
 *   UserPreferencesPage.tsx — to call logout() after saving prefs
 */

import { logDebug, logInfo } from "@/lib/logger";
import { useInternetIdentity } from "@caffeineai/core-infrastructure";

/**
 * useAuth — returns the current auth state and login/logout helpers.
 *
 * VARIABLE INITIALIZATION:
 *   identity      - The Internet Identity object (contains user's principal)
 *   isAuthenticated - true once login is complete
 *   isLoading     - true while II SDK is initialising (renamed from isInitializing)
 *   loginStatus   - raw SDK status string
 *   login         - function to open II login flow
 *   logout        - function to clear identity (renamed from clear)
 */
export function useAuth() {
  logDebug("Entering useAuth");

  const {
    identity,
    loginStatus,
    login,
    clear, // SDK name for logging out — renamed to logout below
    isAuthenticated,
    isInitializing, // true while SDK checks for existing session
  } = useInternetIdentity();

  // Log auth state changes at DEBUG level for diagnostics tracing
  logDebug("useAuth: resolved state", {
    isAuthenticated,
    isInitializing,
    loginStatus,
  });

  /**
   * login wrapper — logs the login attempt at INFO level before delegating.
   * This gives a clear diagnostic marker when the user initiates login.
   */
  const wrappedLogin = async (...args: Parameters<typeof login>) => {
    logInfo("useAuth: login() called — opening Internet Identity");
    return login(...args);
  };

  /**
   * logout wrapper — logs the logout event at INFO level before delegating.
   * Called from Sidebar (explicit logout) and approval gates (forced logout).
   */
  const wrappedLogout = () => {
    logInfo("useAuth: logout() called — clearing Internet Identity session");
    clear();
  };

  return {
    identity,
    isAuthenticated,
    // Rename isInitializing → isLoading for consistent terminology across the app
    isLoading: isInitializing,
    loginStatus,
    login: wrappedLogin,
    logout: wrappedLogout,
  };
}
