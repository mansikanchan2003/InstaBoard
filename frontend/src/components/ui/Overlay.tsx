import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/format';
import { Icon } from './Icon';

/** Open overlays, innermost last — only the topmost one handles Esc / Tab when overlays are stacked. */
const overlayStack: symbol[] = [];

/** Shared overlay behaviour: Esc to close, body scroll lock, initial focus + focus restore, Tab trap. */
function useOverlay(open: boolean, onClose: () => void, panelRef: React.RefObject<HTMLElement>) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const token = Symbol('overlay');
    overlayStack.push(token);
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const focusables = () =>
      panel
        ? Array.from(panel.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'))
        : [];
    (panel?.querySelector<HTMLElement>('[data-autofocus]') ?? focusables()[0] ?? panel)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (overlayStack[overlayStack.length - 1] !== token) return;
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
      } else if (e.key === 'Tab') {
        const items = focusables();
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      overlayStack.splice(overlayStack.indexOf(token), 1);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open, panelRef]);
}

type ModalSize = 'sm' | 'md' | 'lg' | 'xl';
const modalSizes: Record<ModalSize, string> = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' };

/** Surface Level 3 modal: slate-900/40 backdrop, white panel, elevated shadow. */
export function Modal({
  open,
  onClose,
  title,
  subtitle,
  icon,
  size = 'md',
  footer,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: string;
  size?: ModalSize;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useOverlay(open, onClose, panelRef);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn('bg-surface-card border border-border-strong rounded-xl shadow-modal w-full max-h-[90vh] flex flex-col outline-none', modalSizes[size], className)}
      >
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-border-strong">
          <div className="flex items-start gap-3 min-w-0">
            {icon && (
              <div className="w-9 h-9 rounded-lg bg-primary-container/15 text-primary flex items-center justify-center shrink-0">
                <Icon name={icon} className="text-[20px]" />
              </div>
            )}
            <div className="min-w-0">
              <h2 id={titleId} className="font-headline-sm text-headline-sm text-text-primary">
                {title}
              </h2>
              {subtitle && <p className="text-body-sm text-text-secondary mt-0.5">{subtitle}</p>}
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded text-text-secondary hover:text-text-primary hover:bg-surface-canvas" aria-label="Close dialog">
            <Icon name="close" className="text-[20px]" />
          </button>
        </div>
        <div className="px-5 py-4 overflow-y-auto custom-scrollbar flex-1">{children}</div>
        {footer && <div className="px-5 py-3 border-t border-border-strong bg-surface-canvas rounded-b-xl flex items-center justify-end gap-2 flex-wrap">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/** Right-hand drawer (reel / comment / lead / preferences drawers in the export). */
export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  width = 'w-full sm:w-[440px]',
  footer,
  children,
  headerExtra,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  width?: string;
  footer?: ReactNode;
  children: ReactNode;
  headerExtra?: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useOverlay(open, onClose, panelRef);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 bg-slate-900/30 backdrop-blur-xs flex justify-end animate-fade-in" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn('h-full bg-surface-card border-l border-border-strong shadow-2xl flex flex-col animate-slide-in-right outline-none', width)}
      >
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border-strong">
          <div className="min-w-0">
            <h2 id={titleId} className="font-headline-sm text-headline-sm text-text-primary">
              {title}
            </h2>
            {subtitle && <div className="text-body-sm text-text-secondary mt-0.5">{subtitle}</div>}
            {headerExtra}
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded text-text-secondary hover:text-text-primary hover:bg-surface-canvas" aria-label="Close panel">
            <Icon name="close" className="text-[20px]" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-4">{children}</div>
        {footer && <div className="px-5 py-3 border-t border-border-strong bg-surface-canvas flex items-center justify-end gap-2 flex-wrap">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
