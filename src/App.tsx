import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  ArrowDownRight, ArrowRight, ArrowUpRight, Bell, ChevronDown,
  ChevronRight, CircleHelp, Command, Download, Ellipsis, FileDown, Filter, Home, LogOut,
  LayoutGrid, Menu, Moon, Plus, Search, Settings2, Sparkles, Sun, Wallet, X,
} from 'lucide-react'
import { navItems, launcherItems } from './lib/navigation'
import DomainWorkspace from './components/DomainWorkspace'
import FinancialWorkspace from './components/FinancialWorkspace'
import { supabase } from './lib/supabase'
import { createWorkspaceRepository } from './lib/data/repositories'
import type { Workspace } from './lib/data/database.types'

interface AppProps { userEmail: string; onSignOut: () => Promise<void> }

const money = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)
const payments = [
  { initials: 'AS', name: 'Aarav Sharma', property: 'Maple Residency · 2B', date: 'Today, 10:42 AM', amount: 24500, status: 'Paid', tone: 'green' },
  { initials: 'MP', name: 'Meera Patel', property: 'Cedar House · 1A', date: 'Today, 9:18 AM', amount: 18000, status: 'Paid', tone: 'green' },
  { initials: 'RK', name: 'Rohan Kapoor', property: 'Maple Residency · 3C', date: 'Yesterday', amount: 22000, status: 'Pending', tone: 'amber' },
  { initials: 'SI', name: 'Sara Iyer', property: 'Willow Court · 4B', date: 'Yesterday', amount: 26500, status: 'Paid', tone: 'green' },
]
const bars = [38, 54, 46, 68, 58, 76, 63, 83, 69, 91, 77, 100]
const months = ['Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct']

function App({ userEmail, onSignOut }: AppProps) {
  const [active, setActive] = useState('Overview')
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [workspaceId, setWorkspaceId] = useState('')
  const [workspaceLoading, setWorkspaceLoading] = useState(true)
  const [workspaceError, setWorkspaceError] = useState('')
  const [dark, setDark] = useState(false)
  const [launcher, setLauncher] = useState(false)
  const [mobileNav, setMobileNav] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [notice, setNotice] = useState('')
  const [showAll, setShowAll] = useState(false)
  const [range, setRange] = useState('Last 12 months')
  const filteredApps = useMemo(() => launcherItems.filter(item => `${item.label} ${item.hint}`.toLowerCase().includes(query.toLowerCase())), [query])
  useEffect(() => {
    let alive = true
    setWorkspaceLoading(true); setWorkspaceError(''); setWorkspaceId(''); setWorkspaces([])
    if (!supabase) { setWorkspaceError('Supabase is not configured.'); setWorkspaceLoading(false); return () => { alive = false } }
    void createWorkspaceRepository(supabase).listForCurrentUser().then(items => { if (!alive) return; setWorkspaces(items); if (items.length === 1) setWorkspaceId(items[0].id); else if (items.length === 0) setWorkspaceError('No accessible workspace is available. Ask a workspace owner for access.') }).catch(error => { if (alive) setWorkspaceError(error instanceof Error ? error.message : 'Unable to load workspaces.') }).finally(() => { if (alive) setWorkspaceLoading(false) })
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setLauncher(open => !open); setQuery('') }
      if (event.key === 'Escape') { setLauncher(false); setSearchOpen(false); setMobileNav(false) }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => { alive = false; window.removeEventListener('keydown', onKeyDown) }
  }, [userEmail])
  const filteredPayments = payments.filter(p => `${p.name} ${p.property} ${p.status}`.toLowerCase().includes(query.toLowerCase()))

  const navigate = (label: string) => {
    setActive(label)
    setLauncher(false)
    setMobileNav(false)
    setQuery('')
    setNotice('')
  }
  const exportOverview = () => {
    const csv = ['Name,Property,Date,Amount (INR),Status', ...payments.map(p => `"${p.name}","${p.property}","${p.date}",${p.amount},"${p.status}"`)].join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    const a = document.createElement('a'); a.href = url; a.download = 'pos-payment-overview.csv'; a.click(); URL.revokeObjectURL(url)
    setNotice('Payment overview exported as CSV.')
  }

  return <div className={dark ? 'app-shell dark' : 'app-shell'} data-theme={dark ? 'dark' : 'light'}>
    <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
      <div className="brand-row">
        <button className="brand-mark" onClick={() => navigate('Overview')} aria-label="pOS home"><span>p</span><i>o</i><span>S</span></button>
        <span className="brand-word">property OS <span className="brand-version">BETA</span></span>
        <button className="icon-button sidebar-close" aria-label="Close navigation" onClick={() => setMobileNav(false)}><X size={18}/></button>
      </div>
      <label className="workspace-switch-label" htmlFor="active-workspace">Active workspace</label>
      <div className="workspace-switch">
        <span className="workspace-avatar">{(workspaces.find(w => w.id === workspaceId)?.name?.[0] || 'W').toUpperCase()}</span>
        <span className="workspace-meta"><strong>{workspaces.find(w => w.id === workspaceId)?.name || (workspaceLoading ? 'Loading workspaces…' : 'Select workspace')}</strong><small>{workspaceId ? 'Authorized workspace' : 'No active workspace'}</small></span>
        <select id="active-workspace" aria-label="Active workspace" value={workspaceId} disabled={workspaceLoading || workspaces.length === 0} onChange={e => { setWorkspaceId(e.target.value); setNotice('') }}>
          <option value="">Select…</option>{workspaces.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      </div>
      {workspaceError && <p className="workspace-error" role="alert">{workspaceError}</p>}
      <button className="launcher-shortcut" onClick={() => { setLauncher(true); setQuery('') }}><LayoutGrid size={15}/><span>App launcher</span><span className="shortcut-key">⌘ K</span></button>
      <nav className="side-nav" aria-label="Main navigation">
        <div className="nav-group"><p className="nav-label">WORKSPACE</p>{navItems.filter(n => n.section === 'workspace').slice(0,1).map(item => <NavButton key={item.label} item={item} active={active === item.label} onClick={() => navigate(item.label)}/>)}</div>
        <div className="nav-group"><p className="nav-label">PROPERTY MANAGEMENT</p>{navItems.filter(n => n.section === 'manage').map(item => <NavButton key={item.label} item={item} active={active === item.label} onClick={() => navigate(item.label)}/>)}</div>
        <div className="nav-group"><p className="nav-label">INSIGHTS</p>{navItems.filter(n => n.label === 'Reports').map(item => <NavButton key={item.label} item={item} active={active === item.label} onClick={() => navigate(item.label)}/>)}</div>
      </nav>
      <div className="sidebar-bottom">
        <div className="storage-card"><div className="storage-icon"><Sparkles size={16}/></div><div><strong>Your space, your rules.</strong><p>Cloud sign-in is active. Dashboard figures remain sample data.</p></div></div>
        <NavButton item={navItems.find(n => n.label === 'Settings')!} active={active === 'Settings'} onClick={() => navigate('Settings')}/>
        <button className="profile-row" onClick={() => void onSignOut()} title="Sign out" aria-label={`Sign out ${userEmail}`}><div className="profile-avatar">{(userEmail[0] || 'U').toUpperCase()}</div><span className="profile-meta"><strong>{userEmail || 'Signed-in user'}</strong><small>Signed in · Sign out</small></span><LogOut size={17} className="muted-icon"/></button>
      </div>
    </aside>
    {mobileNav && <button className="scrim" aria-label="Close navigation overlay" onClick={() => setMobileNav(false)}/>}

    <main className="main-area">
      <header className="topbar">
        <div className="breadcrumbs"><button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setMobileNav(true)}><Menu size={19}/></button><span className="crumb-home"><Home size={14}/></span><ChevronRight size={13}/><span className="crumb-current">{active}</span></div>
        <div className="top-actions">
          <span className="local-badge"><span className="status-dot"/> Cloud session</span>
          <button className="icon-button top-search" aria-label="Search" onClick={() => { setSearchOpen(!searchOpen); setQuery('') }}><Search size={18}/></button>
          <button className="icon-button" aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'} onClick={() => setDark(!dark)}>{dark ? <Sun size={18}/> : <Moon size={18}/>}</button>
          <button className="icon-button notification-button" aria-label="Notifications" onClick={() => setNotice('You’re all caught up. New reminders will appear here.')}><Bell size={18}/><span/></button>
          <div className="top-divider"/><button className="help-button" onClick={() => setNotice('Help centre is planned for a future release.')}><CircleHelp size={16}/><span>Help</span></button>
        </div>
      </header>
      <div className="content-wrap">
        <AnimatePresence>{notice && <motion.div className="notice-banner" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}><span>{notice}</span><button onClick={() => setNotice('')} aria-label="Dismiss message"><X size={15}/></button></motion.div>}</AnimatePresence>
        {searchOpen && <motion.div className="global-search" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}><Search size={17}/><input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Search people, properties, payments…" aria-label="Search workspace"/><kbd>ESC</kbd><button onClick={() => { setSearchOpen(false); setQuery('') }} aria-label="Close search"><X size={16}/></button></motion.div>}
        {active === 'Overview' ? <>
          <section className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line"/> TUESDAY, OCTOBER 20, 2026</div><h1>Your properties, <em>in perspective.</em></h1><p className="page-subtitle">A clear view of what’s happening across your portfolio.</p></div><div className="heading-actions"><button className="button-secondary" onClick={exportOverview}><Download size={16}/> <span>Export</span></button><button className="button-primary" onClick={() => setNotice('Quick add will be available with the property and tenant workflows in milestone 3.')}><Plus size={17}/> Add new <ChevronDown size={14}/></button></div></section>
          <p className="domain-notice">Sample dashboard figures · illustrative only, not live workspace records.</p><section className="metric-grid" aria-label="Portfolio metrics">
            <MetricCard label="Monthly rent collected" value={money(184500)} delta="12.8%" note="vs. last month" positive icon={<Wallet size={17}/>} accent="sage" chart={[22,28,25,35,31,40,36,52,45,61,55,72]}/>
            <MetricCard label="Occupancy rate" value="92.4%" delta="2.4%" note="vs. last month" positive icon={<Building2Icon/>} accent="blue" chart={[45,48,44,55,52,58,56,63,61,68,70,76]}/>
            <MetricCard label="Outstanding rent" value={money(47200)} delta="8.2%" note="vs. last month" positive={false} icon={<ArrowDownRight size={17}/>} accent="peach" chart={[66,60,72,58,62,49,55,43,47,36,41,29]}/>
            <MetricCard label="Open maintenance" value="08" delta="3 resolved" note="this week" positive icon={<Settings2 size={17}/>} accent="lavender" chart={[70,55,62,48,57,43,48,36,42,29,34,22]}/>
          </section>
          <section className="main-grid">
            <div className="panel collection-panel"><div className="panel-header"><div><div className="panel-kicker">CASH FLOW</div><h2>Collection overview</h2><p>Rent received across your portfolio</p></div><button className="select-button" onClick={() => setRange(range === 'Last 12 months' ? 'Last 6 months' : 'Last 12 months')}>{range}<ChevronDown size={14}/></button></div>
              <div className="chart-summary"><strong>{money(184500)}</strong><span className="trend-pill"><ArrowUpRight size={14}/> 12.8%</span><span className="chart-summary-note">collected this month</span></div>
              <div className="bar-chart" role="img" aria-label="Monthly rent collection trend, November through October">{bars.slice(range === 'Last 6 months' ? 6 : 0).map((height, i) => <div className="bar-column" key={`${months[i]}-${range}`}><div className="bar-track"><div className={`bar-fill ${i === (range === 'Last 6 months' ? 5 : 11) ? 'bar-current' : ''}`} style={{ height: `${height}%` }}/></div><span>{months[i + (range === 'Last 6 months' ? 6 : 0)]}</span></div>)}</div>
              <div className="chart-legend"><span><i className="legend-dot collected"/> Collected</span><span><i className="legend-dot expected"/> Expected</span><span className="chart-footnote">Illustrative overview · INR</span></div>
            </div>
            <div className="panel occupancy-panel"><div className="panel-header"><div><div className="panel-kicker">PORTFOLIO HEALTH</div><h2>Occupancy</h2><p>Across 3 properties</p></div><button className="icon-button panel-more" aria-label="Occupancy options" onClick={() => setNotice('Occupancy options will be available with property records.')}><Ellipsis size={19}/></button></div>
              <div className="occupancy-visual"><svg viewBox="0 0 180 115" role="img" aria-label="92 percent of units occupied"><path d="M 20 100 A 70 70 0 0 1 160 100" fill="none" stroke="var(--track)" strokeWidth="13" strokeLinecap="round"/><path d="M 20 100 A 70 70 0 0 1 151 61" fill="none" stroke="var(--sage)" strokeWidth="13" strokeLinecap="round"/><text x="90" y="77" textAnchor="middle" className="gauge-value">92%</text><text x="90" y="95" textAnchor="middle" className="gauge-label">occupied</text></svg></div>
              <div className="occupancy-stats"><div><span className="occupancy-key"><i className="legend-dot collected"/> Occupied</span><strong>46 units</strong></div><div><span className="occupancy-key"><i className="legend-dot expected"/> Vacant</span><strong>4 units</strong></div></div><button className="text-link" onClick={() => navigate('Properties')}>View properties <ArrowRight size={15}/></button>
            </div>
          </section>
          <section className="panel payments-panel"><div className="panel-header payments-heading"><div><div className="panel-kicker">LATEST ACTIVITY</div><h2>Recent payments</h2><p>A little closer to everything being in order.</p></div><div className="table-actions"><button className="button-secondary filter-button" onClick={() => setShowAll(!showAll)}><Filter size={15}/><span>{showAll ? 'Show recent' : 'All payments'}</span></button><button className="icon-button table-more" aria-label="Export payment list" onClick={exportOverview}><FileDown size={17}/></button></div></div>
            <div className="table-wrap"><table><thead><tr><th>RESIDENT</th><th>PROPERTY / UNIT</th><th>DATE</th><th>AMOUNT</th><th>STATUS</th><th></th></tr></thead><tbody>{(showAll ? [...payments, ...payments.slice(0,2)] : filteredPayments).map((p, i) => <tr key={`${p.name}-${i}`}><td><div className="resident-cell"><div className={`resident-avatar avatar-${i % 4}`}>{p.initials}</div><strong>{p.name}</strong></div></td><td className="property-cell">{p.property}</td><td className="date-cell">{p.date}</td><td className="amount-cell">{money(p.amount)}</td><td><span className={`status-pill ${p.tone}`}><span/>{p.status}</span></td><td><button className="row-action" aria-label={`View ${p.name} payment`} onClick={() => setNotice(`${p.name} · ${money(p.amount)} · ${p.status}. Detailed payment records arrive in milestone 4.`)}><ChevronRight size={16}/></button></td></tr>)}</tbody></table>{!filteredPayments.length && !showAll && <div className="empty-search"><Search size={18}/>No payments match “{query}”.</div>}</div>
            <div className="panel-footer"><span>Showing <strong>{showAll ? 6 : filteredPayments.length}</strong> recent transactions</span><button className="text-link" onClick={() => navigate('Rent & payments')}>View all payments <ArrowRight size={15}/></button></div>
          </section>
          <footer className="page-footer"><span>pOS <span className="footer-dot">·</span> Made for the spaces you care for.</span><span><span className="live-dot"/> Sample data · cloud sync not connected to these figures</span></footer>
        </> : ['Properties','Tenants','Maintenance'].includes(active) ? <DomainWorkspace key={`${active}:${workspaceId}`} kind={active as 'Properties'|'Tenants'|'Maintenance'} workspaceId={workspaceId} workspaceLoading={workspaceLoading} workspaceError={workspaceError} /> : ['Rent & payments','Invoices','Ledger'].includes(active) ? <FinancialWorkspace key={`${active}:${workspaceId}`} kind={active as 'Rent & payments'|'Invoices'|'Ledger'} workspaceId={workspaceId} workspaceLoading={workspaceLoading} workspaceError={workspaceError} /> : <section className="coming-view"><div className="coming-icon"><Sparkles size={24}/></div><div className="eyebrow"><span className="eyebrow-line"/> YOUR WORKSPACE</div><h1>{active}<em>, thoughtfully organized.</em></h1><p>This part of pOS is being built as a connected workflow, not just another screen.</p><div className="coming-card"><div className="coming-card-icon"><Command size={20}/></div><div><strong>One step at a time</strong><span>Milestone 1 establishes the shell and design system. {active} will be implemented in its dedicated build milestone.</span></div><button className="button-secondary" onClick={() => navigate('Overview')}>Back to overview <ArrowRight size={15}/></button></div><button className="text-link" onClick={() => { setLauncher(true); setQuery('') }}>Explore the app launcher <ArrowRight size={15}/></button></section>}
      </div>
    </main>

    <AnimatePresence>{launcher && <><motion.button className="launcher-scrim" aria-label="Close app launcher" onClick={() => setLauncher(false)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}/><motion.div className="launcher-modal" role="dialog" aria-modal="true" aria-label="App launcher" initial={{ opacity: 0, scale: .97, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: .98, y: 5 }} transition={{ duration: .16 }}><div className="launcher-top"><div><span className="launcher-eyebrow">MY WORKSPACE</span><h2>Your workspace</h2></div><button className="icon-button" aria-label="Close app launcher" onClick={() => setLauncher(false)}><X size={18}/></button></div><label className="launcher-search"><Search size={17}/><input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Find an app…"/><kbd>ESC</kbd></label><div className="launcher-grid">{filteredApps.map(item => <button className="launcher-app" key={item.label} onClick={() => item.label === 'App library' || item.label === 'Help & support' || item.label === 'Calendar' ? setNotice(`${item.label} is planned for a future release.`) : navigate(item.label)}><span className="app-icon"><item.icon size={19}/></span><strong>{item.label}</strong><small>{item.hint}</small></button>)}</div><div className="launcher-bottom"><span><Command size={13}/> A workspace that grows with you</span><span>ESC to close</span></div></motion.div></>}</AnimatePresence>
  </div>
}

function NavButton({ item, active, onClick }: { item: typeof navItems[number]; active: boolean; onClick: () => void }) {
  const Icon = item.icon
  return <button className={`nav-item ${active ? 'nav-active' : ''}`} onClick={onClick}><Icon size={17} strokeWidth={active ? 2.15 : 1.8}/><span>{item.label}</span>{item.badge && <span className="nav-badge">{item.badge}</span>}{active && <span className="active-rail"/>}</button>
}
function Building2Icon() { return <span className="tiny-building">⌂</span> }
function MetricCard({ label, value, delta, note, positive, icon, accent, chart }: { label: string; value: string; delta: string; note: string; positive: boolean; icon: ReactNode; accent: string; chart: number[] }) {
  return <article className="metric-card"><div className="metric-top"><span>{label}</span><span className={`metric-icon ${accent}`}>{icon}</span></div><div className="metric-value">{value}</div><div className="metric-bottom"><span className={`metric-delta ${positive ? 'delta-positive' : 'delta-negative'}`}>{positive ? <ArrowUpRight size={14}/> : <ArrowDownRight size={14}/>} {delta}</span><span className="metric-note">{note}</span><div className="mini-chart" aria-hidden="true">{chart.map((h, i) => <i key={i} style={{ height: `${h}%` }}/>)}</div></div></article>
}
export default App
