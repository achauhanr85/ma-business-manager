import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export interface ImpersonationState {
  isImpersonating: boolean;
  profileKey: string;
  profileName: string;
  originalRole: string;
}

interface ImpersonationContextValue extends ImpersonationState {
  startImpersonation: (profileKey: string, profileName: string) => void;
  stopImpersonation: () => void;
}

const STORAGE_KEY = "ma_herb_impersonation";

const defaultState: ImpersonationState = {
  isImpersonating: false,
  profileKey: "",
  profileName: "",
  originalRole: "superAdmin",
};

const ImpersonationContext = createContext<ImpersonationContextValue>({
  ...defaultState,
  startImpersonation: () => {},
  stopImpersonation: () => {},
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
    (profileKey: string, profileName: string) => {
      setState({
        isImpersonating: true,
        profileKey,
        profileName,
        originalRole: "superAdmin",
      });
    },
    [],
  );

  const stopImpersonation = useCallback(() => {
    setState(defaultState);
  }, []);

  return (
    <ImpersonationContext.Provider
      value={{ ...state, startImpersonation, stopImpersonation }}
    >
      {children}
    </ImpersonationContext.Provider>
  );
}

export function useImpersonation(): ImpersonationContextValue {
  return useContext(ImpersonationContext);
}
