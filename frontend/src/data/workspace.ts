import type { TeamMember, Workspace } from '@/types/domain';
import { media } from './media';

/** DEMO DATA — values taken from the Stitch screens (reporting window Oct 1–31, 2024). */
export const workspace: Workspace = {
  id: 'ws-eko-india',
  name: 'Eko India Financial Services',
  plan: 'Enterprise',
  timezone: 'Asia/Kolkata (IST, UTC+05:30)',
  currency: 'INR (₹)',
  reportingPeriod: { start: '2024-10-01', end: '2024-10-31', label: 'Last 30 Days: Oct 1 - Oct 31, 2024' },
  baselinePeriod: { start: '2024-09-01', end: '2024-09-30', label: 'Sep 1 - Sep 30, 2024' },
  lastSyncedLabel: 'Synced 12m ago',
};

export const currentUserId = 'usr-priya';

export const teamMembers: TeamMember[] = [
  {
    id: 'usr-priya',
    name: 'Priya Sharma',
    email: 'priya.sharma@eko.example',
    role: 'Growth Lead',
    access: 'Owner',
    status: 'active',
    lastActive: 'Active now',
  },
  {
    id: 'usr-rahul',
    name: 'Rahul Verma',
    email: 'rahul.verma@eko.example',
    role: 'Campaign Manager',
    access: 'Admin',
    avatarUrl: media.professionalHeadshotCorporateDigitalMarketing.url,
    status: 'active',
    lastActive: '18m ago',
  },
  {
    id: 'usr-ananya',
    name: 'Ananya Iyer',
    email: 'ananya.iyer@eko.example',
    role: 'Content Strategist',
    access: 'Editor',
    avatarUrl: media.corporatePortraitEnergeticYoungIndian.url,
    status: 'active',
    lastActive: '2h ago',
  },
  {
    id: 'usr-arjun',
    name: 'Arjun Mehta',
    email: 'arjun.mehta@eko.example',
    role: 'Performance Analyst',
    access: 'Editor',
    avatarUrl: media.cleanModernProfessionalCorporatePortrait.url,
    status: 'active',
    lastActive: 'Yesterday',
  },
  {
    id: 'usr-kavya',
    name: 'Kavya Nair',
    email: 'kavya.nair@eko.example',
    role: 'Lead Operations',
    access: 'Viewer',
    status: 'invited',
    lastActive: 'Invite pending',
  },
];
