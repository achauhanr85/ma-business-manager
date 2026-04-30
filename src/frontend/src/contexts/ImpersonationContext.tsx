/**
 * ImpersonationContext.tsx — Tracks whether the Super Admin is currently
 * viewing the app as a different role (Admin or Staff) for a specific profile.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * PAGE FLOW
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * INITIALIZATION FLOW:
 *   1. Provider mounts
 *   2. useState initializer reads localStorage (key: 'indi_negocio_impersonation')
 *   3. If stored session found → restore previous impersonation state
 *      (survives page refresh without ending impersonation)
 *   4. If no stored session → use defaultState (isImpersonating = false)
 *
 * START IMPERSONATION FLOW:
 *   SuperAdminPage calls startImpersonation(profileKey, profileName, role?)
 *   → setState({ isImpersonating: true, profileKey, profileName, ... })
 *   → useEffect persists new state to localStorage
 *   → App.tsx detects isImpersonating = true → shows impersonated UI
 *   → Sidebar uses impersonateAsRole for nav item filtering
 *   → Header shows operational icons for the impersonated role
 *
 * STOP IMPERSONATION FLOW:
 *   User clicks "Exit" in impersonation banner → stopImpersonation()
 *   → setState(defaultState) → isImpersonating = false
 *   → useEffect removes localStorage key
 *   → App.tsx switches back to Super Admin dashboard
 *
 * ROLE SWITCH FLOW (while impersonating):
 *   Role selector dropdown → setImpersonationRole("admin" | "staff")
 *   → setState({ ...prev, impersonateAsRole: role })
 *   → Sidebar and Header immediately reflect the new role's nav items
 *
 * DIAGNOSTIC LOGGING:
 *   TRACE (0): state initialization
 *   DEBUG (1): function entry, state transitions
 *   INFO  (2): impersonation start/stop confirmed
 *
 * WHO USES THIS:
 *   App.tsx / SuperAdminApp — switch between SA and impersonated pages
 *   Layout.tsx — show the impersonation banner
 *   Header.tsx — conditionally show create-action icons
 *   Sidebar.tsx — filter nav items based on effective role
 *   SuperAdminPage.tsx — calls startImpersonation() and setImpersonationRole()
 */

import { logDebug, logInfo, logTrace } from "@/lib/logger";
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
  /** Human-readable name of the profile (shown in the banner) */
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

/**
 * defaultState — the initial non-impersonating state.
 *
 * VARIABLE INITIALIZATION:
 *   isImpersonating: false — not currently impersonating
 *   profileKey: "" — no profile selected
 *   profileName: "" — no profile name
 *   originalRole: "superAdmin" — SA's real role never changes
 *   impersonateAsRole: "admin" — default if SA starts without specifying
 */
const defaultState: ImpersonationState = {
  isImpersonating: false,
  profileKey: "",
  profileName: "",
  originalRole: "superAdmin",
  impersonateAsRole: "admin",
};

const ImpersonationContext = createContext<ImpersonationContextValue>({
  ...defaultState,
  startImpersonation: () => {},
  stopImpersonation: () => {},
  setImpersonationRole: () => {},
});

/**
 * ImpersonationProvider — wrap around the authenticated app.
 *
 * On mount, reads any previously saved state from localStorage so
 * an impersonation session survives a browser refresh.
 */
export function ImpersonationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  /**
   * state — the full impersonation state.
   *
   * VARIABLE INITIALIZATION:
   *   - Tries to read from localStorage first (persist session across refresh)
   *   - Falls back to defaultState if no stored data or parse error
   */
  const [state, setState] = useState<ImpersonationState>(() => {
    logTrace("ImpersonationContext: initializing state from localStorage");
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as ImpersonationState;
        logTrace("ImpersonationContext: restored state from localStorage", {
          isImpersonating: parsed.isImpersonating,
          profileKey: parsed.profileKey,
          impersonateAsRole: parsed.impersonateAsRole,
        });
        return parsed;
      }
    } catch {
      logDebug(
        "ImpersonationContext: localStorage parse failed, using defaultState",
      );
    }
    return defaultState;
  });

  // Persist state to localStorage whenever it changes.
  // Remove the key when NOT impersonating to avoid stale data.
  useEffect(() => {
    if (state.isImpersonating) {
      logTrace(
        "ImpersonationContext: persisting impersonation state to localStorage",
        {
          profileKey: state.profileKey,
          role: state.impersonateAsRole,
        },
      );
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [state]);

  /**
   * startImpersonation — begins impersonation for a profile.
   *
   * FLOW:
   *   Called from SuperAdminPage when SA clicks "Impersonate as Admin/Staff"
   *   → setState with new impersonation data
   *   → useEffect persists to localStorage
   *   → App.tsx routing switches to impersonated view
   *
   * @param profileKey  - The business profile to impersonate within
   * @param profileName - Human-readable name shown in the banner
   * @param role        - Which role to impersonate (defaults to "admin")
   */
  const startImpersonation = useCallback(
    (
      profileKey: string,
      profileName: string,
      role: ImpersonationRole = "admin",
    ) => {
      logDebug("ImpersonationContext: startImpersonation called", {
        profileKey,
        profileName,
        role,
      });
      setState({
        isImpersonating: true,
        profileKey,
        profileName,
        originalRole: "superAdmin",
        impersonateAsRole: role,
      });
      logInfo("ImpersonationContext: impersonation started", {
        profileKey,
        role,
      });
    },
    [],
  );

  /**
   * stopImpersonation — ends impersonation and returns SA to their dashboard.
   *
   * FLOW:
   *   SA clicks "Exit" in impersonation banner → stopImpersonation()
   *   → setState(defaultState)
   *   → useEffect removes localStorage key
   *   → App.tsx routing switches back to SA dashboard
   */
  const stopImpersonation = useCallback(() => {
    logDebug("ImpersonationContext: stopImpersonation called");
    setState(defaultState);
    logInfo(
      "ImpersonationContext: impersonation ended — returned to SA dashboard",
    );
  }, []);

  /**
   * setImpersonationRole — switches between admin and staff while already
   * impersonating. Does NOT end the impersonation session.
   *
   * FLOW:
   *   Role selector dropdown → setImpersonationRole("staff")
   *   → setState({ ...prev, impersonateAsRole: "staff" })
   *   → Sidebar and Header immediately reflect Staff nav items
   */
  const setImpersonationRole = useCallback((role: ImpersonationRole) => {
    logDebug("ImpersonationContext: setImpersonationRole called", { role });
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
 */
export function useImpersonation(): ImpersonationContextValue {
  return useContext(ImpersonationContext);
}
