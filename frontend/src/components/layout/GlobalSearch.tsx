import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@/hooks/useQuery';
import { cn } from '@/lib/format';
import { campaignService } from '@/services/campaigns';
import { contentService } from '@/services/content';
import { leadService } from '@/services/leads';
import { Icon } from '@/components/ui/Icon';

interface Result {
  id: string;
  label: string;
  sublabel: string;
  icon: string;
  to: string;
}

/** Header search across campaigns, content and leads in the demo dataset. ⌘K / Ctrl+K focuses it. */
export function GlobalSearch({ className }: { className?: string }) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const campaigns = useQuery('campaigns:list', campaignService.list);
  const content = useQuery('content:list', contentService.list);
  const leads = useQuery('leads:list', leadService.list);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const results = useMemo<Result[]>(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    const match = (...fields: string[]) => fields.some((f) => f.toLowerCase().includes(term));
    return [
      ...(campaigns.data ?? [])
        .filter((c) => match(c.name, c.code, c.objective))
        .map((c) => ({ id: c.id, label: c.name, sublabel: `Campaign · ${c.code}`, icon: 'campaign', to: `/campaigns/${c.id}` })),
      ...(content.data ?? [])
        .filter((c) => match(c.title, c.caption))
        .map((c) => ({ id: c.id, label: c.title, sublabel: `Content · ${c.type}`, icon: c.type === 'reel' ? 'movie' : 'image', to: `/content/${c.id}` })),
      ...(leads.data ?? [])
        .filter((l) => match(l.name, l.handle, l.location))
        .map((l) => ({ id: l.id, label: l.name, sublabel: `Lead · @${l.handle} · ${l.location}`, icon: 'contact_page', to: `/leads?lead=${l.id}` })),
    ].slice(0, 8);
  }, [q, campaigns.data, content.data, leads.data]);

  const go = (r: Result) => {
    navigate(r.to);
    setQ('');
    setOpen(false);
    inputRef.current?.blur();
  };

  return (
    <div className={cn('relative', className)}>
      <Icon name="search" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary text-[18px] pointer-events-none" />
      <input
        ref={inputRef}
        type="search"
        role="combobox"
        aria-expanded={open && q.length > 0}
        aria-controls="global-search-results"
        aria-label="Search campaigns, reels, handles"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, results.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === 'Enter' && results[active]) {
            go(results[active]);
          } else if (e.key === 'Escape') {
            setOpen(false);
            inputRef.current?.blur();
          }
        }}
        className="w-full h-8 pl-8 pr-12 bg-surface-canvas border border-border-strong rounded-lg text-label-md text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-0 focus:border-border-focused transition-all"
        placeholder="Search campaigns, reels, handles..."
      />
      <kbd className="hidden md:block absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-text-tertiary border border-border-strong rounded px-1 bg-surface-card">⌘K</kbd>
      {open && q.trim() && (
        <ul id="global-search-results" role="listbox" className="absolute z-40 mt-1 w-full min-w-[20rem] bg-surface-card border border-slate-300 rounded-lg shadow-flyout py-1 max-h-80 overflow-y-auto">
          {results.length === 0 ? (
            <li className="px-3 py-3 text-body-sm text-text-secondary">No campaigns, content or leads match “{q}”.</li>
          ) : (
            results.map((r, i) => (
              <li key={`${r.to}`} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => go(r)}
                  onMouseEnter={() => setActive(i)}
                  className={cn('w-full text-left px-3 py-2 flex items-center gap-2.5', i === active ? 'bg-surface-canvas' : '')}
                >
                  <Icon name={r.icon} className="text-[18px] text-text-secondary" />
                  <span className="min-w-0">
                    <span className="block text-label-md text-text-primary font-semibold truncate">{r.label}</span>
                    <span className="block text-[11px] text-text-tertiary truncate capitalize">{r.sublabel}</span>
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
