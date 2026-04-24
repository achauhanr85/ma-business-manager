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
}

const ProfileContext = createContext<ProfileContextValue>({
  userProfile: null,
  profile: null,
  isLoadingProfile: true,
  hasFetchedProfile: false,
  isProfileDisabled: false,
  refetchProfile: async () => {},
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
 *
 * Dry-run: Governance Gatekeeper scenario
 *  - If profile.end_date is yesterday (in nanoseconds), Date.now() * 1e6 > end_date
 *    → function returns true → frontend blocks "Create Sale" and shows restriction message.
 *  - If profile.is_enabled === false → returns true immediately.
 *  - Both checks mirror the backend checkProfileAccess logic.
 */
function checkProfileDisabled(profile: ProfilePublic | null): boolean {
  if (!profile) return false;
  if (profile.is_archived) return true;
  // Check is_enabled flag (present in updated backend schema)
  if ("is_enabled" in profile && profile.is_enabled === false) return true;
  // Check active date window (timestamps are nanoseconds from backend)
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

  const fetchProfiles = useCallback(async () => {
    if (!actor) return;
    setIsLoadingProfile(true);
    try {
      const up = await actor.getUserProfile();
      setUserProfile(up ?? null);

      // Super Admin users don't need a profileKey — skip profile-specific calls.
      // This prevents errors or unnecessary fetches when a SUPER_ADMIN has no profile.
      if (up?.role === UserRole.superAdmin) {
        setProfile(null);
        setIsProfileDisabled(false);
        setHasFetchedProfile(true);
        setIsLoadingProfile(false);
        return;
      }

      if (up) {
        const p = await actor.getProfile();
        const profileData = p ?? null;
        setProfile(profileData);

        // Apply theme color whenever profile is loaded/refreshed
        if (profileData?.theme_color) {
          applyThemeColor(profileData.theme_color);
        }

        // Check if profile is disabled or outside active window
        setIsProfileDisabled(checkProfileDisabled(profileData));
      } else {
        setProfile(null);
        setIsProfileDisabled(false);
      }
      // Mark that we have successfully completed a fetch (data may be null = new user)
      setHasFetchedProfile(true);
    } catch {
      // Network/actor errors — silently degrade but do NOT set hasFetchedProfile
      // so that the routing logic won't misinterpret an error as "no profile exists"
    } finally {
      setIsLoadingProfile(false);
    }
  }, [actor]);

  useEffect(() => {
    if (actor && !isFetching) {
      fetchProfiles();
    }
  }, [actor, isFetching, fetchProfiles]);

  // Re-apply theme whenever profile.theme_color changes
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
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile(): ProfileContextValue {
  return useContext(ProfileContext);
}
