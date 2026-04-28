import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export type ImpersonationRole = "admin" | "staff";

export interface ImpersonationState {
  isImpersonating: boolean;
  profileKey: string;
  profileName: string;
  originalRole: string;
  /** The role Super Admin is impersonating as */
  impersonateAsRole: ImpersonationRole;
}

interface ImpersonationContextValue extends ImpersonationState {
  startImpersonation: (
    profileKey: string,
    profileName: string,
    role?: ImpersonationRole,
  ) => void;
  stopImpersonation: () => void;
  setImpersonationRole: (role: ImpersonationRole) => void;
}

const STORAGE_KEY = "indi_negocio_impersonation";

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

export function ImpersonationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, setState] = useState<ImpersonationState>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return JSON.parse(stored) as ImpersonationState;
    } catch {
      // ignore
    }
    return defaultState;
  });

  // Persist to localStorage whenever state changes
  useEffect(() => {
    if (state.isImpersonating) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [state]);

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

  const stopImpersonation = useCallback(() => {
    setState(defaultState);
  }, []);

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

export function useImpersonation(): ImpersonationContextValue {
  return useContext(ImpersonationContext);
}
