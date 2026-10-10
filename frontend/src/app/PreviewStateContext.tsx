import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Every Stitch screen ships an "Interactive States" switcher (Normal / Skeleton / Empty / Error).
 * We keep it as a clearly-labelled demo control: it forces every data query on the current page
 * into that state so reviewers can see the loading, empty and error designs. It resets on navigation.
 */
export type PreviewState = 'normal' | 'loading' | 'empty' | 'error';

interface PreviewStateValue {
  state: PreviewState;
  setState: (s: PreviewState) => void;
}

const PreviewStateContext = createContext<PreviewStateValue>({ state: 'normal', setState: () => {} });

export function PreviewStateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PreviewState>('normal');
  const { pathname } = useLocation();

  useEffect(() => {
    setState('normal');
  }, [pathname]);

  const value = useMemo(() => ({ state, setState }), [state]);
  return <PreviewStateContext.Provider value={value}>{children}</PreviewStateContext.Provider>;
}

export const usePreviewState = () => useContext(PreviewStateContext);
