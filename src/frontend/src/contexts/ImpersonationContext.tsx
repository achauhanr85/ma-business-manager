/**
 * ImpersonationContext.tsx — Tracks whether the Super Admin is currently
 * viewing the app as a different role (Admin or Staff) for a specific profile.
 *
 * WHAT THIS FILE DOES:
 * When the Super Admin clicks "Impersonate as Admin" or "Impersonate as Staff"
 * on the Super Admin dashboard, this context stores that state. Any component
 * that needs to know "are we in impersonation mode?" (e.g. Sidebar, Header,
 * SuperAdminApp) reads from this context.
 *
 * State is persisted to localStorage so a page refresh doesn't end impersonation.
 *
 * WHO USES THIS:
 *   App.tsx / SuperAdminApp — to switch between Super Admin and impersonated pages
 *   Layout.tsx — to show the impersonation banner
 *   Header.tsx — to conditionally show create-action icons
 *   Sidebar.tsx — to filter nav items based on effective role
 *   SuperAdminPage.tsx — to call `startImpersonation()` and `setImpersonationRole()`
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

/** The two roles the Super Admin can impersonate as */
export type ImpersonationRole = "admin" | "staff";

/** Shape of the impersonation state object */
export interface ImpersonationState {
  /** true when Super Admin is actively viewing as another role */
  isImpersonating: boolean;
  /** The profile key of the profile being impersonated */
  profileKey: string;
  /** Human-readable name of the profile being impersonated (shown in the banner) */
  profileName: string;
  /** The Super Admin's real role — always "superAdmin" */
  originalRole: string;
  /** Which role is being impersonated — "admin" or "staff" */
  impersonateAsRole: ImpersonationRole;
}

/** Everything the context exposes — state + the three action functions */
interface ImpersonationContextValue extends ImpersonationState {
  /** Begin impersonation for a profile. Optionally specify which role to start as. */
  startImpersonation: (
    profileKey: string,
    profileName: string,
    role?: ImpersonationRole,
  ) => void;
  /** End impersonation and return to the Super Admin's own dashboard */
  stopImpersonation: () => void;
  /** Switch between admin and staff while already impersonating */
  setImpersonationRole: (role: ImpersonationRole) => void;
}

/** The localStorage key where impersonation state is persisted */
const STORAGE_KEY = "indi_negocio_impersonation";

/** Default (non-impersonating) state */
const defaultState: ImpersonationState = {
  isImpersonating: false,
  profileKey: "",
  profileName: "",
  originalRole: "superAdmin",
  impersonateAsRole: "admin",
};

// Create context with no-op defaults — real values are provided by ImpersonationProvider
const ImpersonationContext = createContext<ImpersonationContextValue>({
  ...defaultState,
  startImpersonation: () => {},
  stopImpersonation: () => {},
  setImpersonationRole: () => {},
});

/**
 * ImpersonationProvider — wrap around the authenticated app to make impersonation
 * state available everywhere.
 *
 * On mount, it reads any previously saved state from localStorage so an impersonation
 * session survives a browser refresh.
 */
export function ImpersonationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // Initialise from localStorage if a session was saved (e.g. after a page refresh)
  const [state, setState] = useState<ImpersonationState>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return JSON.parse(stored) as ImpersonationState;
    } catch {
      // Corrupted storage — silently fall back to default
    }
    return defaultState;
  });

  // Persist state to localStorage whenever it changes so a refresh doesn't lose it.
  // Clear the key when NOT impersonating to avoid stale data.
  useEffect(() => {
    if (state.isImpersonating) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [state]);

  /**
   * startImpersonation — called from the Super Admin dashboard when clicking
   * "Impersonate as Admin" or "Impersonate as Staff" for a profile.
   */
  const startImpersonation = useCallback(
    (
      profileKey: string,
      profileName: string,
      role: ImpersonationRole = "admin",
    ) => {
      setState({
        isImpersonating: true,
        profileKey,
        profileName,
        originalRole: "superAdmin",
        impersonateAsRole: role,
      });
    },
    [],
  );

  /**
   * stopImpersonation — called when the Super Admin clicks "Exit" in the
   * impersonation banner. Resets state to default, which causes App.tsx to
   * switch back to the Super Admin dashboard.
   */
  const stopImpersonation = useCallback(() => {
    setState(defaultState);
  }, []);

  /**
   * setImpersonationRole — switches between admin and staff view without
   * stopping impersonation entirely. Used by the role selector dropdown.
   */
  const setImpersonationRole = useCallback((role: ImpersonationRole) => {
    setState((prev) => ({ ...prev, impersonateAsRole: role }));
  }, []);

  return (
    <ImpersonationContext.Provider
      value={{
        ...state,
        startImpersonation,
        stopImpersonation,
        setImpersonationRole,
      }}
    >
      {children}
    </ImpersonationContext.Provider>
  );
}

/**
 * useImpersonation — hook for accessing impersonation state in any component.
 * Returns the full context value including all three action functions.
 */
export function useImpersonation(): ImpersonationContextValue {
  return useContext(ImpersonationContext);
}
