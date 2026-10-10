import { useNavigate } from 'react-router-dom';
import { LeadStatusBadge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Misc';
import { Skeleton } from '@/components/ui/States';
import { TableShell, Td, Th, Tr } from '@/components/tables/DataTable';
import type { QueryResult } from '@/hooks/useQuery';
import { cn } from '@/lib/format';
import type { Campaign, Lead, LeadSource } from '@/types/domain';
import { SectionCard, UnavailableNote } from './SectionCard';

const sourceLabel: Record<LeadSource, string> = { comment: 'Comment', dm: 'Instagram DM', bio_link: 'Bio & CTA link', profile_visit: 'Profile visit' };

/** Leads tab: the campaign's leads from `leadService.listByCampaign`; rows open the lead drawer on /leads. */
export function CampaignLeadsList({ campaign, query }: { campaign: Campaign; query: QueryResult<Lead[]> }) {
  const navigate = useNavigate();
  const leads = [...(query.data ?? [])].sort((a, b) => b.score - a.score);
  const total = campaign.metrics?.leads;
  return (
    <SectionCard
      icon="person_search"
      title="Campaign Leads"
      titleSize="sm"
      addon={
        query.status === 'success' &&
        total !== undefined && (
          <span className="px-2 py-0.5 rounded-full font-label-sm text-label-sm bg-surface-card-subtle text-text-secondary border border-border-strong tnum">
            {leads.length} of {total} in demo sample
          </span>
        )
      }
      link={{ to: '/leads', label: 'Open Leads Pipeline' }}
    >
      {query.status === 'loading' ? (
        <div className="mt-4 space-y-2">
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
        </div>
      ) : query.status === 'error' ? (
        <UnavailableNote icon="warning">Leads could not be loaded. {query.error?.message}</UnavailableNote>
      ) : leads.length === 0 ? (
        <UnavailableNote icon="contact_page">
          {campaign.metrics ? 'No individual leads for this campaign are included in the demo dataset.' : 'Metrics will appear after the campaign starts.'}
        </UnavailableNote>
      ) : (
        <div className="mt-4 -mx-5 -mb-5 border-t border-border-strong">
          <TableShell>
            <thead>
              <tr>
                <Th>Lead</Th>
                <Th>Location</Th>
                <Th align="right">AI Score</Th>
                <Th>Status</Th>
                <Th>Source</Th>
                <Th>Last Contact</Th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <Tr key={l.id} onClick={() => navigate(`/leads?lead=${l.id}`)} label={`Open lead ${l.name}`}>
                  <Td>
                    <div className="flex items-center gap-2.5 min-w-[200px]">
                      <Avatar name={l.name} size="sm" />
                      <div className="min-w-0">
                        <div className="font-semibold text-text-primary">{l.name}</div>
                        <div className="text-[11px] text-text-secondary">@{l.handle}</div>
                      </div>
                    </div>
                  </Td>
                  <Td className="text-text-secondary whitespace-nowrap">{l.location}</Td>
                  <Td align="right" className={cn('font-bold', l.score >= 90 ? 'text-status-active' : 'text-text-primary')}>
                    {l.score}
                  </Td>
                  <Td>
                    <LeadStatusBadge status={l.status} />
                  </Td>
                  <Td className="text-text-secondary whitespace-nowrap">{sourceLabel[l.source]}</Td>
                  <Td className="text-text-secondary whitespace-nowrap">{l.lastContact}</Td>
                </Tr>
              ))}
            </tbody>
          </TableShell>
        </div>
      )}
    </SectionCard>
  );
}
