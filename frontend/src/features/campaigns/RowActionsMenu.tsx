import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@/components/ui/Icon';

const MENU_WIDTH = 208;

/**
 * Row "more" menu rendered in a fixed-position portal so it is never clipped by the
 * horizontally scrolling table container (the shared Dropdown is absolutely positioned).
 * Closes on outside click, Esc, scroll and resize. Candidate for promotion to src/components/ui.
 */
export function RowActionsMenu({ label, children }: { label: string; children: (close: () => void) => ReactNode }) {
  const [pos, setPos] = useState<{ top: number; left: number; up: boolean } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const close = () => setPos(null);

  const toggle = () => {
    if (pos) return close();
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const up = r.bottom + 240 > window.innerHeight;
    setPos({ top: up ? r.top - 4 : r.bottom + 4, left: Math.max(8, Math.min(window.innerWidth - MENU_WIDTH - 8, r.right - MENU_WIDTH)), up });
  };

  useEffect(() => {
    if (!pos) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!menuRef.current?.contains(t) && !btnRef.current?.contains(t)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close();
        btnRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [pos]);

  useLayoutEffect(() => {
    if (pos) menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, [pos]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={!!pos}
        onClick={(e) => {
          e.stopPropagation();
          toggle();
        }}
        onKeyDown={(e) => e.stopPropagation()}
        className="p-1 rounded text-text-tertiary hover:text-text-primary hover:bg-surface-card"
      >
        <Icon name="more_vert" className="text-[16px]" />
      </button>
      {pos &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label={label}
            onClick={(e) => e.stopPropagation()}
            style={{ position: 'fixed', top: pos.top, left: pos.left, width: MENU_WIDTH, transform: pos.up ? 'translateY(-100%)' : undefined }}
            className="z-50 bg-surface-card border border-slate-300 rounded-lg shadow-flyout py-1 animate-fade-in"
          >
            {children(close)}
          </div>,
          document.body,
        )}
    </>
  );
}
