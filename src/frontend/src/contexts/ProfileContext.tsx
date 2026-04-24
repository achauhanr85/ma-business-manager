import { createActor } from "@/backend";
import type { ProfilePublic, UserProfilePublic } from "@/backend";
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
  refetchProfile: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextValue>({
  userProfile: null,
  profile: null,
  isLoadingProfile: true,
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

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { actor, isFetching } = useBackendActor();
  const [userProfile, setUserProfile] = useState<UserProfilePublic | null>(
    null,
  );
  const [profile, setProfile] = useState<ProfilePublic | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);

  const fetchProfiles = useCallback(async () => {
    if (!actor) return;
    setIsLoadingProfile(true);
    try {
      const up = await actor.getUserProfile();
      setUserProfile(up ?? null);

      if (up) {
        const p = await actor.getProfile();
        setProfile(p ?? null);
        if (p?.theme_color) {
          applyThemeColor(p.theme_color);
        }
      }
    } catch {
      // Network/actor errors — silently degrade
    } finally {
      setIsLoadingProfile(false);
    }
  }, [actor]);

  useEffect(() => {
    if (actor && !isFetching) {
      fetchProfiles();
    }
  }, [actor, isFetching, fetchProfiles]);

  return (
    <ProfileContext.Provider
      value={{
        userProfile,
        profile,
        isLoadingProfile,
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
