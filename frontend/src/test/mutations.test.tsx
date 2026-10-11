import { act, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { withProviders } from '@/App';
import { routes } from '@/app/routes';
import { ToastProvider } from '@/components/ui/Toast';
import { useMutation } from '@/hooks/useMutation';
import { clearQueryCache, useQuery } from '@/hooks/useQuery';
import { campaignService } from '@/services/campaigns';
import { commentsService } from '@/services/comments';
import { leadService } from '@/services/leads';

/** Demo-mode (default) mutation behaviour: hook semantics, service rules and a full UI flow. */
const wrapper = ({ children }: { children: ReactNode }) => <ToastProvider>{children}</ToastProvider>;

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

describe('useMutation', () => {
  beforeEach(() => clearQueryCache());

  it('ignores a duplicate submission while the same call is in flight', async () => {
    const gate = deferred<string>();
    const fn = vi.fn(() => gate.promise);
    const { result } = renderHook(() => useMutation(fn), { wrapper });
    let first: Promise<string | undefined>, second: Promise<string | undefined>;
    act(() => {
      first = result.current.mutate();
      second = result.current.mutate();
    });
    await expect(second!).resolves.toBeUndefined();
    expect(fn).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(result.current.isPending).toBe(true));
    await act(async () => gate.resolve('done'));
    await expect(first!).resolves.toBe('done');
    expect(result.current.isPending).toBe(false);
  });

  it('still allows different submissions concurrently', async () => {
    const fn = vi.fn(async (id: string) => id);
    const { result } = renderHook(() => useMutation(fn), { wrapper });
    await act(async () => {
      await Promise.all([result.current.mutate('a'), result.current.mutate('b')]);
    });
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('shows the error message in a toast when no onError is given', async () => {
    const { result } = renderHook(() => useMutation(async () => Promise.reject(new Error('A completed campaign cannot be moved to active.'))), { wrapper });
    await act(async () => {
      await result.current.mutate();
    });
    expect(result.current.error?.message).toMatch(/cannot be moved/);
    expect(await screen.findByText('A completed campaign cannot be moved to active.')).toBeInTheDocument();
  });

  it('refreshes subscribed queries after success', async () => {
    let calls = 0;
    const fetcher = vi.fn(async () => ++calls);
    const { result } = renderHook(
      () => ({ q: useQuery('test:counter', fetcher), m: useMutation(async () => 'ok', { invalidate: ['test'] }) }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.q.data).toBe(1));
    await act(async () => {
      await result.current.m.mutate();
    });
    await waitFor(() => expect(result.current.q.data).toBe(2));
  });
});

describe('demo-mode services', () => {
  it('persists lead notes in the demo store', async () => {
    await leadService.updateDetails('lead-vikram-chauhan', { notes: '  Visit booked for Monday  ' });
    const lead = (await leadService.list()).find((l) => l.id === 'lead-vikram-chauhan');
    expect(lead?.notes).toBe('Visit booked for Monday');
  });

  it('converts a comment once and links on repeat (no duplicate lead)', async () => {
    const { items } = await commentsService.list();
    const leadsBefore = await leadService.list();
    const handles = new Set(leadsBefore.map((l) => l.handle.toLowerCase()));
    const target = items.find((c) => !c.leadId && c.campaignId && !handles.has(c.handle.toLowerCase()))!;
    const first = await commentsService.convertToLead(target.id);
    expect(first.created).toBe(true);
    expect(first.comment.status).toBe('lead_created');
    expect(first.lead.sourceCommentId).toBe(target.id);
    const again = await commentsService.convertToLead(target.id);
    expect(again).toMatchObject({ created: false, lead: { id: first.lead.id } });
    expect((await leadService.list()).length).toBe(leadsBefore.length + 1);
  });

  it('enforces the same campaign status transitions as the API', async () => {
    await expect(campaignService.setStatus('digital-banking-awareness', 'active')).rejects.toThrow('A completed campaign cannot be moved to active.');
    await expect(campaignService.setStatus('micro-atm-awareness-push', 'scheduled')).rejects.toThrow(/start date and end date/);
    await expect(campaignService.setStatus('rural-banking-access', 'active')).resolves.toMatchObject({ status: 'active' });
  });
});

describe('LeadDrawer notes (UI)', () => {
  beforeEach(() => clearQueryCache());

  it('saves notes once even when Save is clicked twice, then shows success', async () => {
    const spy = vi.spyOn(leadService, 'updateDetails');
    const router = createMemoryRouter(withProviders(routes), { initialEntries: ['/leads?lead=lead-mohd-arif'] });
    render(<RouterProvider router={router} />);
    const dialog = await screen.findByRole('dialog', {}, { timeout: 15000 });
    const notes = await within(dialog).findByLabelText('Internal Outreach Notes');
    fireEvent.change(notes, { target: { value: 'Shared document checklist on WhatsApp' } });
    const save = within(dialog).getByRole('button', { name: /Save & Close/ });
    fireEvent.click(save);
    fireEvent.click(save);
    expect(await screen.findByText('Outreach notes saved')).toBeInTheDocument();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('lead-mohd-arif', { notes: 'Shared document checklist on WhatsApp' });
    spy.mockRestore();
  });
});
