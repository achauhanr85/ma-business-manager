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

export interface ProfileContextValue {
  userProfile: UserProfilePublic | null;
  profile: ProfilePublic | null;
  isLoadingProfile: boolean;
  /** True once at least one fetch attempt has fully completed (success or empty — not network error) */
  hasFetchedProfile: boolean;
  /** True when the profile is archived/disabled or outside its active window */
  isProfileDisabled: boolean;
  refetchProfile: () => Promise<void>;
  /**
   * Super Admin active profile key — set when Super Admin selects a profile to
   * manage or starts impersonation. All record-creates by Super Admin must pass
   * this as their profileKey so data is scoped to the correct profile.
   */
  superAdminActiveProfileKey: string | null;
  setSuperAdminActiveProfileKey: (key: string | null) => void;
}

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

function useBackendActor() {
  return useActor(createActor);
}

/**
 * Applies ONLY the profile brand color as a CSS variable overlay on top of
 * the current theme. Does NOT touch --background, --card, or any structural
 * tokens — those are owned by the theme class applied by applyTheme().
 */
function applyProfileBrandColor(themeColor: string) {
  if (!themeColor?.startsWith("#")) return;
  try {
    const oklch = hexToOklch(themeColor);
    const root = document.documentElement;

    // Set --primary as the full OKLCH string
    root.style.setProperty("--primary", oklch);
    root.style.setProperty("--primary-raw", themeColor);

    // Parse OKLCH components for --theme-color-* utility vars
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
    // Silently ignore invalid colors
  }
}

/**
 * Checks if a profile is disabled due to archival, explicit disable, or being
 * outside its active date window.
 */
function checkProfileDisabled(profile: ProfilePublic | null): boolean {
  if (!profile) return false;
  if (profile.is_archived) return true;
  if ("is_enabled" in profile && profile.is_enabled === false) return true;
  const nowNs = BigInt(Date.now()) * BigInt(1_000_000);
  if ("start_date" in profile && profile.start_date != null) {
    if (nowNs < profile.start_date) return true;
  }
  if ("end_date" in profile && profile.end_date != null) {
    if (nowNs > profile.end_date) return true;
  }
  return false;
}

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { actor, isFetching } = useBackendActor();
  const [userProfile, setUserProfile] = useState<UserProfilePublic | null>(
    null,
  );
  const [profile, setProfile] = useState<ProfilePublic | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [hasFetchedProfile, setHasFetchedProfile] = useState(false);
  const [isProfileDisabled, setIsProfileDisabled] = useState(false);

  // Super Admin active profile key for scoping record creates
  const [superAdminActiveProfileKey, setSuperAdminActiveProfileKey] = useState<
    string | null
  >(null);

  const fetchProfiles = useCallback(async () => {
    if (!actor) return;
    setIsLoadingProfile(true);
    try {
      const up = await actor.getUserProfile();
      setUserProfile(up ?? null);

      // Super Admin users don't need a profileKey — skip profile-specific calls.
      if (up?.role === UserRole.superAdmin) {
        setProfile(null);
        setIsProfileDisabled(false);
        setHasFetchedProfile(true);
        setIsLoadingProfile(false);
        // Load Super Admin's saved active profile key from backend
        try {
          const activeKey = await actor.getSuperAdminActiveProfile();
          setSuperAdminActiveProfileKey(activeKey ?? null);
        } catch {
          // Non-fatal — active profile key is optional
        }
        return;
      }

      if (up) {
        const p = await actor.getProfile();
        const profileData = p ?? null;
        setProfile(profileData);

        // Apply profile brand color as overlay (does NOT override theme tokens)
        if (profileData?.theme_color) {
          applyProfileBrandColor(profileData.theme_color);
        }

        setIsProfileDisabled(checkProfileDisabled(profileData));
      } else {
        setProfile(null);
        setIsProfileDisabled(false);
      }
      setHasFetchedProfile(true);
    } catch {
      // Network/actor errors — do NOT set hasFetchedProfile so routing logic
      // won't misinterpret an error as "no profile exists"
    } finally {
      setIsLoadingProfile(false);
    }
  }, [actor]);

  useEffect(() => {
    if (actor && !isFetching) {
      fetchProfiles();
    }
  }, [actor, isFetching, fetchProfiles]);

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

export function useProfile(): ProfileContextValue {
  return useContext(ProfileContext);
}
