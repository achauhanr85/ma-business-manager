import { useInternetIdentity } from "@caffeineai/core-infrastructure";

export function useAuth() {
  const {
    identity,
    loginStatus,
    login,
    clear,
    isAuthenticated,
    isInitializing,
  } = useInternetIdentity();

  return {
    identity,
    isAuthenticated,
    isLoading: isInitializing,
    loginStatus,
    login,
    logout: clear,
  };
}
