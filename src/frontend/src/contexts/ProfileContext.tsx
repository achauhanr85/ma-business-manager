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

function applyThemeColor(themeColor: string) {
  if (!themeColor || !themeColor.startsWith("#")) return;
  try {
    const oklch = hexToOklch(themeColor);
    document.documentElement.style.setProperty("--primary", oklch);
    document.documentElement.style.setProperty("--primary-raw", themeColor);
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

        if (profileData?.theme_color) {
          applyThemeColor(profileData.theme_color);
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
      applyThemeColor(profile.theme_color);
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
