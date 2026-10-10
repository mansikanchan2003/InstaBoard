import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

/** App-wide UI actions triggered from shared chrome (sidebar CTA, header) and pages. */
interface AppUiValue {
  createCampaignOpen: boolean;
  openCreateCampaign: () => void;
  closeCreateCampaign: () => void;
  mobileNavOpen: boolean;
  setMobileNavOpen: (open: boolean) => void;
  lastSyncedLabel: string;
  setLastSyncedLabel: (label: string) => void;
}

const AppUiContext = createContext<AppUiValue | null>(null);

export function AppUiProvider({ children, initialSyncLabel }: { children: ReactNode; initialSyncLabel: string }) {
  const [createCampaignOpen, setCreateCampaignOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [lastSyncedLabel, setLastSyncedLabel] = useState(initialSyncLabel);
  const openCreateCampaign = useCallback(() => setCreateCampaignOpen(true), []);
  const closeCreateCampaign = useCallback(() => setCreateCampaignOpen(false), []);

  const value = useMemo(
    () => ({ createCampaignOpen, openCreateCampaign, closeCreateCampaign, mobileNavOpen, setMobileNavOpen, lastSyncedLabel, setLastSyncedLabel }),
    [createCampaignOpen, openCreateCampaign, closeCreateCampaign, mobileNavOpen, lastSyncedLabel],
  );
  return <AppUiContext.Provider value={value}>{children}</AppUiContext.Provider>;
}

export function useAppUi() {
  const ctx = useContext(AppUiContext);
  if (!ctx) throw new Error('useAppUi must be used inside <AppUiProvider>');
  return ctx;
}
