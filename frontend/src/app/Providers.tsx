import type { ReactNode } from 'react';
import { ToastProvider } from '@/components/ui/Toast';
import { sessionWorkspace } from '@/services/workspace';
import { AppUiProvider } from './AppUiContext';
import { PreviewStateProvider } from './PreviewStateContext';

/** Providers that need router context (PreviewState resets on navigation). */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <PreviewStateProvider>
        <AppUiProvider initialSyncLabel={sessionWorkspace.lastSyncedLabel}>{children}</AppUiProvider>
      </PreviewStateProvider>
    </ToastProvider>
  );
}
