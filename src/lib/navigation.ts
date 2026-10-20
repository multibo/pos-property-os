import {
  Activity, Archive, BellRing, Building2, CalendarDays, CircleHelp, ClipboardList,
  CreditCard, FileText, Gauge, LayoutGrid, Settings2, Users, Wrench,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type NavItem = { label: string; icon: LucideIcon; section: 'workspace' | 'manage' | 'system'; badge?: string }
export const navItems: NavItem[] = [
  { label: 'Overview', icon: Gauge, section: 'workspace' },
  { label: 'Properties', icon: Building2, section: 'manage' },
  { label: 'Tenants', icon: Users, section: 'manage' },
  { label: 'Rent & payments', icon: CreditCard, section: 'manage' },
  { label: 'Invoices', icon: FileText, section: 'manage' },
  { label: 'Ledger', icon: Activity, section: 'manage' },
  { label: 'Maintenance', icon: Wrench, section: 'manage', badge: '3' },
  { label: 'Overdue', icon: BellRing, section: 'manage', badge: '2' },
  { label: 'Reports', icon: ClipboardList, section: 'workspace' },
  { label: 'Settings', icon: Settings2, section: 'system' },
]
export const launcherItems = [
  { label: 'Overview', icon: Gauge, hint: 'Your portfolio at a glance' },
  { label: 'Properties', icon: Building2, hint: 'Buildings, units and occupancy' },
  { label: 'Tenants', icon: Users, hint: 'People and lease details' },
  { label: 'Rent & payments', icon: CreditCard, hint: 'Collections and payment history' },
  { label: 'Invoices', icon: FileText, hint: 'Invoices and receipts' },
  { label: 'Ledger', icon: Activity, hint: 'Every transaction, in one place' },
  { label: 'Maintenance', icon: Wrench, hint: 'Requests and repair tracking' },
  { label: 'Overdue', icon: BellRing, hint: 'Follow up on late payments' },
  { label: 'Reports', icon: Archive, hint: 'Portfolio insights and exports' },
  { label: 'Settings', icon: Settings2, hint: 'Preferences and data controls' },
  { label: 'Calendar', icon: CalendarDays, hint: 'Coming in a future release' },
  { label: 'Help & support', icon: CircleHelp, hint: 'Guides and product help' },
  { label: 'App library', icon: LayoutGrid, hint: 'Your workspace, ready to grow' },
]
