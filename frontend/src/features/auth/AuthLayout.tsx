import type { ReactNode } from 'react';
import { Icon } from '@/components/ui/Icon';

/** Centered card layout for the sign-in / invitation screens (Eko InstaBoard branding). */
export function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="min-h-screen bg-surface-canvas flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-6 justify-center">
          <div className="w-10 h-10 rounded-lg bg-surface-card border border-border-strong p-1 flex items-center justify-center">
            <img src="/eko-logo.png" alt="Eko" className="w-full h-full object-contain" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-headline-md text-headline-sm text-text-primary font-bold tracking-tight">InstaBoard</span>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-primary-container text-text-primary leading-none">v2.4</span>
            </div>
            <span className="font-label-sm text-label-sm text-text-secondary">Enterprise Analytics</span>
          </div>
        </div>
        <div className="bg-surface-card border border-border-strong rounded-xl shadow-card p-6">
          <h1 className="font-headline-md text-headline-md text-text-primary">{title}</h1>
          {subtitle && <p className="text-body-sm text-text-secondary mt-1">{subtitle}</p>}
          <div className="mt-5">{children}</div>
        </div>
        {footer && <div className="mt-4 text-center text-body-sm text-text-secondary">{footer}</div>}
        <p className="mt-6 flex items-center justify-center gap-1.5 text-[11px] text-text-tertiary">
          <Icon name="lock" className="text-[14px]" /> Secure session cookie · no Instagram credentials are requested
        </p>
      </div>
    </div>
  );
}

/** Only allow redirects back into the app (prevents open redirects via ?next=). */
export function safeNext(raw: string | null): string {
  // Only same-app paths: reject absolute/protocol-relative URLs, backslashes (browsers treat "/\x" as "//x") and control characters.
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || /[\\\x00-\x1f]/.test(raw)) return '/dashboard';
  if (raw.startsWith('/login') || raw.startsWith('/accept-invite')) return '/dashboard';
  return raw;
}
