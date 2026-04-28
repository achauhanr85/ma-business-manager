/**
 * ProfileContext.tsx — Fetches and caches the current user's profile and role.
 *
 * WHAT THIS FILE DOES:
 * After login, the app needs to know TWO things about the user:
 *   1. Their `UserProfile` — role, warehouse, display name, approval status
 *   2. Their `Profile` — business name, logo, theme colour, Instagram handle
 *
 * This context fetches both from the backend on mount and makes them available
 * everywhere via `useProfile()`.
 *
 * It also:
 *   - Applies the profile's brand colour as a CSS variable (`--primary`) so all
 *     buttons and accents use the business's colour
 *   - Checks whether the profile is disabled/archived/outside its active window
 *   - Stores the Super Admin's "active profile key" — the profile they are currently
 *     managing — so all data creates/queries are scoped to the right profile
 *
 * IMPORTANT: Super Admin users do NOT have a `profile` in the normal sense.
 * When the role is `superAdmin`, this context skips the profile fetch and sets
 * `profile = null`. Super Admin uses `superAdminActiveProfileKey` instead.
 *
 * WHO USES THIS:
 *   App.tsx (AuthenticatedApp) — reads `isProfileDisabled`
 *   Layout.tsx — reads `profile` (for brand colour) and `userProfile` (for role)
 *   Sidebar.tsx — reads `userProfile.role` to filter nav items
 *   Header.tsx — reads `userProfile.display_name` and `userProfile.role`
 *   NotificationsPanel.tsx — reads `profile.profile_key` for notification queries
 *   SuperAdminPage.tsx — calls `setSuperAdminActiveProfileKey` when selecting a profile
 *   All pages that create data — read `superAdminActiveProfileKey` to scope writes
 */

import { createActor } from "@/backend";
import type { ProfilePublic, UserProfilePublic } from "@/backend";
import { UserRole } from "@/backend";
import { hexToOklch } from "@/lib/color";
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
  /** true once at least one fetch attempt has fully completed (success or empty) */
  hasFetchedProfile: boolean;
  /** true when the profile is archived/disabled or outside its active date window */
  isProfileDisabled: boolean;
  /** Re-fetch both profile records from the backend */
  refetchProfile: () => Promise<void>;
  /**
   * The profile key the Super Admin is currently managing.
   * ALL data operations (create/query) by Super Admin must pass this key
   * so records are scoped to the correct business profile.
   * null when Super Admin has not selected a profile yet.
   */
  superAdminActiveProfileKey: string | null;
  /** Called by SuperAdminPage when the Super Admin selects a profile */
  setSuperAdminActiveProfileKey: (key: string | null) => void;
}

// Create context with safe defaults for components rendered outside the provider
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

/** Internal helper to get a reference to the backend actor */
function useBackendActor() {
  return useActor(createActor);
}

/**
 * applyProfileBrandColor — applies the business profile's theme colour as
 * CSS variable overlays on top of the active theme.
 *
 * IMPORTANT: This only sets `--primary` and `--theme-color-*`. It does NOT
 * change `--background`, `--card`, or any other structural tokens — those
 * are owned by the active theme class (e.g. `theme-dark`) set in index.css.
 *
 * This means: theme controls the layout look, brand colour controls accent colour.
 */
function applyProfileBrandColor(themeColor: string) {
  if (!themeColor?.startsWith("#")) return;
  try {
    // Convert hex to OKLCH format for CSS compatibility
    const oklch = hexToOklch(themeColor);
    const root = document.documentElement;

    // Set --primary as the full OKLCH string (e.g. "52.1% 0.132 142.3")
    root.style.setProperty("--primary", oklch);
    // Keep the raw hex for code that reads it back (e.g. colour pickers)
    root.style.setProperty("--primary-raw", themeColor);

    // Extract OKLCH components for fine-grained utility classes
    const match = oklch.match(/([\d.]+)%?\s+([\d.]+)\s+([\d.]+)/);
    if (match) {
      const l = Number.parseFloat(match[1]) / 100;
      const c = Number.parseFloat(match[2]);
      const h = Number.parseFloat(match[3]);
      root.style.setProperty("--theme-color-l", String(l));
      root.style.setProperty("--theme-color-c", String(c));
      root.style.setProperty("--theme-color-h", String(h));
    }
  } catch {
    // Silently ignore invalid colour values — profile will just use default primary
  }
}

/**
 * checkProfileDisabled — returns true when the given profile should block access.
 * A profile is disabled when any of these is true:
 *   - is_archived is true (permanently removed from active use)
 *   - is_enabled is false (manually disabled by Super Admin)
 *   - Current time is before the profile's start_date (active window not yet begun)
 *   - Current time is after the profile's end_date (active window has expired)
 */
function checkProfileDisabled(profile: ProfilePublic | null): boolean {
  if (!profile) return false;
  if (profile.is_archived) return true;
  if ("is_enabled" in profile && profile.is_enabled === false) return true;
  // IC timestamps are in nanoseconds — convert current time to nanoseconds for comparison
  const nowNs = BigInt(Date.now()) * BigInt(1_000_000);
  if ("start_date" in profile && profile.start_date != null) {
    if (nowNs < profile.start_date) return true; // too early
  }
  if ("end_date" in profile && profile.end_date != null) {
    if (nowNs > profile.end_date) return true; // expired
  }
  return false;
}

/**
 * ProfileProvider — fetches and provides profile data for the authenticated user.
 * Place this inside `ImpersonationProvider` and outside `UserPreferencesProvider`.
 */
export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { actor, isFetching } = useBackendActor();

  // `userProfile` — role, warehouse, display name, approval status
  const [userProfile, setUserProfile] = useState<UserProfilePublic | null>(
    null,
  );
  // `profile` — business name, logo, theme colour (null for Super Admin)
  const [profile, setProfile] = useState<ProfilePublic | null>(null);
  // Loading state — true until the first fetch attempt completes
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  // Flag set to true once the first successful fetch has finished
  const [hasFetchedProfile, setHasFetchedProfile] = useState(false);
  // Whether the profile is currently blocked (archived/disabled/out of window)
  const [isProfileDisabled, setIsProfileDisabled] = useState(false);

  // Super Admin's currently selected profile key — all SA data ops use this
  const [superAdminActiveProfileKey, setSuperAdminActiveProfileKey] = useState<
    string | null
  >(null);

  /**
   * fetchProfiles — fetches user profile and (for non-SA users) the business profile.
   * Uses `useCallback` so it can be passed as a stable reference to `refetchProfile`.
   */
  const fetchProfiles = useCallback(async () => {
    if (!actor) return;
    setIsLoadingProfile(true);
    try {
      // Step 1: get the user's own profile (role, warehouse, etc.)
      const up = await actor.getUserProfile();
      setUserProfile(up ?? null);

      // Step 2: Super Admin does not have a standard business profile
      // Skip the profile fetch and just load the SA's previously selected active profile key
      if (up?.role === UserRole.superAdmin) {
        setProfile(null);
        setIsProfileDisabled(false);
        setHasFetchedProfile(true);
        setIsLoadingProfile(false);
        try {
          // Restore which profile Super Admin was managing (persisted in backend)
          const activeKey = await actor.getSuperAdminActiveProfile();
          setSuperAdminActiveProfileKey(activeKey ?? null);
        } catch {
          // Non-fatal — Super Admin can select a profile manually
        }
        return;
      }

      // Step 3: for non-SA users, fetch the business profile they belong to
      if (up) {
        const p = await actor.getProfile();
        const profileData = p ?? null;
        setProfile(profileData);

        // Apply brand colour as a CSS overlay on top of the active theme
        if (profileData?.theme_color) {
          applyProfileBrandColor(profileData.theme_color);
        }

        // Check if the profile is disabled/archived/expired
        setIsProfileDisabled(checkProfileDisabled(profileData));
      } else {
        // User has no profile yet (new user) — will be routed to onboarding
        setProfile(null);
        setIsProfileDisabled(false);
      }
      setHasFetchedProfile(true);
    } catch {
      // Network or actor errors — do NOT set hasFetchedProfile so the routing
      // logic won't misinterpret a failed fetch as "user has no profile"
    } finally {
      setIsLoadingProfile(false);
    }
  }, [actor]);

  // Fetch profiles once the actor is ready
  useEffect(() => {
    if (actor && !isFetching) {
      fetchProfiles();
    }
  }, [actor, isFetching, fetchProfiles]);

  // Re-apply brand colour whenever the profile's theme_color changes (e.g. after edit)
  useEffect(() => {
    if (profile?.theme_color) {
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
 * Returns both the user's own profile (role/warehouse) and the business profile.
 */
export function useProfile(): ProfileContextValue {
  return useContext(ProfileContext);
}
