/**
 * ProfileContext.tsx — Fetches and caches the current user's profile and role.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * PAGE FLOW
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * FETCH FLOW (on actor ready):
 *   1. actor + !isFetching → fetchProfiles() called
 *   2. getUserProfile() → sets userProfile (role, warehouse, approval status)
 *   3. Role check:
 *      - superAdmin → setProfile(null), getSuperAdminActiveProfile() to restore
 *        previously selected profile key
 *      - other → getProfile() → sets profile (business name, logo, theme colour)
 *        → applyProfileBrandColor(themeColor) → --primary CSS var updated
 *        → checkProfileDisabled() → setIsProfileDisabled
 *   4. setHasFetchedProfile(true) → routing logic can proceed
 *   5. setIsLoadingProfile(false) → loading spinner dismissed
 *
 * BRAND COLOUR FLOW:
 *   profile.theme_color changes (e.g. after editing profile)
 *   → useEffect re-fires → applyProfileBrandColor(theme_color)
 *   → --primary CSS variable updated on <html>
 *   → buttons, accents, borders all update to new brand colour
 *
 * PROFILE DISABLED FLOW:
 *   checkProfileDisabled(profile) checks:
 *     - is_archived = true → blocked
 *     - is_enabled = false → blocked
 *     - now < start_date → blocked (too early)
 *     - now > end_date → blocked (expired)
 *   App.tsx reads isProfileDisabled to show a blocked screen
 *
 * SUPER ADMIN ACTIVE PROFILE FLOW:
 *   Super Admin selects a profile in SuperAdminPage
 *   → setSuperAdminActiveProfileKey(key) called
 *   → all data create/query operations by SA scope to this key
 *
 * DIAGNOSTIC LOGGING:
 *   TRACE (0): variable initialization
 *   DEBUG (1): function entry, each step in fetchProfiles
 *   INFO  (2): successful fetches
 *   WARN  (3): empty results, no profile found for user
 *   ERROR (4): catch blocks
 *
 * WHO USES THIS:
 *   App.tsx (AuthenticatedApp) — reads isProfileDisabled
 *   Layout.tsx — reads profile (brand colour) and userProfile (role)
 *   Sidebar.tsx — reads userProfile.role to filter nav items
 *   Header.tsx — reads userProfile.display_name and role
 *   NotificationsPanel.tsx — reads profile.profile_key for notification queries
 *   SuperAdminPage.tsx — calls setSuperAdminActiveProfileKey
 *   All pages that create data — read superAdminActiveProfileKey to scope writes
 */

import { createActor } from "@/backend";
import type { ProfilePublic, UserProfilePublic } from "@/backend";
import { UserRole } from "@/backend";
import { hexToOklch } from "@/lib/color";
import { logDebug, logError, logInfo, logTrace, logWarn } from "@/lib/logger";
import { useActor } from "@caffeineai/core-infrastructure";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

/** Everything the ProfileContext exposes to consumers */
export interface ProfileContextValue {
  /** The logged-in user's profile record (role, warehouse, display name, etc.) */
  userProfile: UserProfilePublic | null;
  /** The business profile record (name, logo, theme colour, etc.) */
  profile: ProfilePublic | null;
  /** true while the first fetch is in progress */
  isLoadingProfile: boolean;
  /** true once at least one fetch attempt has fully completed */
  hasFetchedProfile: boolean;
  /** true when the profile is archived/disabled or outside its active date window */
  isProfileDisabled: boolean;
  /** Re-fetch both profile records from the backend */
  refetchProfile: () => Promise<void>;
  /**
   * The profile key the Super Admin is currently managing.
   * ALL data operations by Super Admin must pass this key to scope records
   * to the correct business profile.
   * null when Super Admin has not selected a profile yet.
   */
  superAdminActiveProfileKey: string | null;
  /** Called by SuperAdminPage when the Super Admin selects a profile */
  setSuperAdminActiveProfileKey: (key: string | null) => void;
}

// Context with safe defaults for components rendered outside the provider
const ProfileContext = createContext<ProfileContextValue>({
  userProfile: null,
  profile: null,
  isLoadingProfile: true,
  hasFetchedProfile: false,
  isProfileDisabled: false,
  refetchProfile: async () => {},
  superAdminActiveProfileKey: null,
  setSuperAdminActiveProfileKey: () => {},
});

/** Internal helper to get the backend actor */
function useBackendActor() {
  return useActor(createActor);
}

/**
 * applyProfileBrandColor — applies the business profile's theme colour as
 * CSS variable overlays on top of the active theme.
 *
 * FLOW:
 *   1. Validate themeColor starts with "#" (hex format)
 *   2. Convert hex → OKLCH string (e.g. "52.1% 0.132 142.3")
 *   3. Set --primary on document.documentElement
 *   4. Set --primary-raw (raw hex for colour pickers)
 *   5. Extract L, C, H components for utility classes
 *
 * NOTE: Only sets --primary and --theme-color-*. Does NOT change
 * --background, --card, or other structural tokens — those belong to the
 * active theme class (e.g. theme-dark). This means: theme controls layout
 * look, brand colour controls accent colour.
 */
function applyProfileBrandColor(themeColor: string) {
  if (!themeColor?.startsWith("#")) return;
  logDebug("applyProfileBrandColor: applying brand colour", { themeColor });
  try {
    const oklch = hexToOklch(themeColor);
    const root = document.documentElement;

    root.style.setProperty("--primary", oklch);
    root.style.setProperty("--primary-raw", themeColor);

    const match = oklch.match(/([\d.]+)%?\s+([\d.]+)\s+([\d.]+)/);
    if (match) {
      const l = Number.parseFloat(match[1]) / 100;
      const c = Number.parseFloat(match[2]);
      const h = Number.parseFloat(match[3]);
      // TRACE: variable initialization for OKLCH components
      logTrace("applyProfileBrandColor: OKLCH components", { l, c, h });
      root.style.setProperty("--theme-color-l", String(l));
      root.style.setProperty("--theme-color-c", String(c));
      root.style.setProperty("--theme-color-h", String(h));
    }
  } catch (err) {
    logError("applyProfileBrandColor: failed to apply brand colour", err);
  }
}

/**
 * checkProfileDisabled — returns true when the given profile should block access.
 *
 * FLOW:
 *   - null profile → false (not disabled — likely Super Admin or new user)
 *   - is_archived = true → true (permanently removed)
 *   - is_enabled = false → true (manually disabled by SA)
 *   - now < start_date → true (active window not yet begun)
 *   - now > end_date → true (active window has expired)
 *
 * VARIABLE INITIALIZATION:
 *   nowNs: bigint — current time in nanoseconds for IC timestamp comparison
 */
function checkProfileDisabled(profile: ProfilePublic | null): boolean {
  if (!profile) return false;
  if (profile.is_archived) return true;
  if ("is_enabled" in profile && profile.is_enabled === false) return true;

  // nowNs: current time in nanoseconds (IC timestamps are nanoseconds)
  const nowNs = BigInt(Date.now()) * BigInt(1_000_000);
  logTrace("checkProfileDisabled: nowNs", String(nowNs));

  if ("start_date" in profile && profile.start_date != null) {
    if (nowNs < profile.start_date) {
      logWarn("checkProfileDisabled: profile blocked (before start_date)", {
        profileKey: profile.profile_key,
      });
      return true;
    }
  }
  if ("end_date" in profile && profile.end_date != null) {
    if (nowNs > profile.end_date) {
      logWarn("checkProfileDisabled: profile blocked (after end_date)", {
        profileKey: profile.profile_key,
      });
      return true;
    }
  }
  return false;
}

/**
 * ProfileProvider — fetches and provides profile data for the authenticated user.
 * Place inside ImpersonationProvider and outside UserPreferencesProvider.
 */
export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { actor, isFetching } = useBackendActor();

  // TRACE: variable initialization for all profile state
  const [userProfile, setUserProfile] = useState<UserProfilePublic | null>(
    null,
  );
  const [profile, setProfile] = useState<ProfilePublic | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [hasFetchedProfile, setHasFetchedProfile] = useState(false);
  const [isProfileDisabled, setIsProfileDisabled] = useState(false);
  const [superAdminActiveProfileKey, setSuperAdminActiveProfileKey] = useState<
    string | null
  >(null);

  logTrace("ProfileContext: state initialized", {
    isLoadingProfile,
    hasFetchedProfile,
    superAdminActiveProfileKey,
  });

  /**
   * fetchProfiles — fetches user profile and (for non-SA) the business profile.
   *
   * FLOW:
   *   1. getUserProfile() → resolve role
   *   2. if superAdmin → skip business profile, restore active profile key
   *   3. else → getProfile() → apply brand colour → check disabled
   *   4. setHasFetchedProfile(true)
   *   5. setIsLoadingProfile(false)
   */
  const fetchProfiles = useCallback(async () => {
    if (!actor) {
      logWarn("ProfileContext: fetchProfiles called but actor not ready");
      return;
    }
    logDebug("ProfileContext: fetchProfiles started");
    setIsLoadingProfile(true);
    try {
      // Step 1: get the user's own profile (role, warehouse, etc.)
      logDebug("ProfileContext: calling getUserProfile()");
      const up = await actor.getUserProfile();
      setUserProfile(up ?? null);
      logInfo("ProfileContext: getUserProfile returned", {
        role: up?.role,
        hasProfile: !!up,
      });

      if (!up) {
        // New user with no profile — will be routed to onboarding
        logWarn("ProfileContext: no userProfile found — routing to onboarding");
        setProfile(null);
        setIsProfileDisabled(false);
        setHasFetchedProfile(true);
        setIsLoadingProfile(false);
        return;
      }

      // Step 2: Super Admin does not have a standard business profile
      if (up.role === UserRole.superAdmin) {
        logDebug(
          "ProfileContext: user is Super Admin — skipping business profile fetch",
        );
        setProfile(null);
        setIsProfileDisabled(false);
        setHasFetchedProfile(true);
        setIsLoadingProfile(false);
        try {
          // Restore which profile SA was previously managing
          logDebug("ProfileContext: restoring Super Admin active profile key");
          const activeKey = await actor.getSuperAdminActiveProfile();
          // TRACE: variable initialization for activeKey
          logTrace("ProfileContext: superAdminActiveProfileKey", activeKey);
          setSuperAdminActiveProfileKey(activeKey ?? null);
        } catch (err) {
          logWarn(
            "ProfileContext: getSuperAdminActiveProfile failed (non-fatal)",
            err,
          );
        }
        return;
      }

      // Step 3: for non-SA users, fetch the business profile
      logDebug("ProfileContext: calling getProfile() for non-SA user");
      const p = await actor.getProfile();
      const profileData = p ?? null;
      setProfile(profileData);
      logInfo("ProfileContext: getProfile returned", {
        profileKey: profileData?.profile_key,
        hasThemeColor: !!profileData?.theme_color,
      });

      // Apply brand colour as CSS overlay on top of the active theme
      if (profileData?.theme_color) {
        applyProfileBrandColor(profileData.theme_color);
      } else {
        logWarn(
          "ProfileContext: profile has no theme_color — using theme default",
        );
      }

      // Check if the profile is blocked (archived/disabled/out of window)
      const disabled = checkProfileDisabled(profileData);
      setIsProfileDisabled(disabled);
      if (disabled) {
        logWarn("ProfileContext: profile is disabled/archived/expired", {
          profileKey: profileData?.profile_key,
        });
      }

      setHasFetchedProfile(true);
    } catch (err) {
      logError("ProfileContext: fetchProfiles failed", err);
      // Do NOT set hasFetchedProfile on error so routing logic doesn't
      // misinterpret a failed fetch as "user has no profile"
    } finally {
      setIsLoadingProfile(false);
      logDebug("ProfileContext: fetchProfiles completed");
    }
  }, [actor]);

  // Fetch profiles once the actor is ready
  useEffect(() => {
    if (actor && !isFetching) {
      logDebug("ProfileContext: actor ready, calling fetchProfiles");
      fetchProfiles();
    }
  }, [actor, isFetching, fetchProfiles]);

  // Re-apply brand colour whenever the profile's theme_color changes
  useEffect(() => {
    if (profile?.theme_color) {
      logDebug("ProfileContext: theme_color changed, re-applying brand colour");
      applyProfileBrandColor(profile.theme_color);
    }
  }, [profile?.theme_color]);

  return (
    <ProfileContext.Provider
      value={{
        userProfile,
        profile,
        isLoadingProfile,
        hasFetchedProfile,
        isProfileDisabled,
        refetchProfile: fetchProfiles,
        superAdminActiveProfileKey,
        setSuperAdminActiveProfileKey,
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
}

/**
 * useProfile — hook for accessing profile data in any component.
 */
export function useProfile(): ProfileContextValue {
  return useContext(ProfileContext);
}
