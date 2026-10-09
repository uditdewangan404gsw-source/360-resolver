'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, ChevronDown, CircleHelp, Search, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { createComplaintAction, saveDuplicateDecisionAction, updateComplaintAction } from '@/app/actions/resolver'
import { AuthScreen } from './auth-screen'
import type { ResolverWorkspace } from './data-mappers'
import { ComplaintDetailView } from './complaint-detail-view'
import { DashboardView } from './dashboard-view'
import { InboxView } from './inbox-view'
import { Sidebar } from './sidebar'
import { AnalyticsView, DuplicateClustersView, KnowledgeBaseView, NewComplaintView, SettingsView, SlaEscalationsView, TeamManagementView } from './secondary-views'
import { navigation, type Complaint, type UserRole, type ViewKey } from './types'

function DemoLogin({ onLogin }: { onLogin: (role: UserRole) => void }) {
  return <main className="login-screen"><div className="login-brand"><div className="flex size-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-[0_8px_24px_rgba(37,90,197,.25)]"><ShieldCheck className="size-5" /></div><div><div className="text-[15px] font-semibold tracking-tight text-slate-900">360° Resolver</div><div className="text-[10px] text-slate-500">COMPLAINT OPERATIONS PLATFORM</div></div></div><div className="login-card"><div className="mb-7"><span className="login-kicker">HACKATHON DEMO WORKSPACE</span><h1 className="mt-3 text-[26px] font-semibold tracking-[-0.045em] text-slate-950">Welcome back</h1><p className="mt-2 text-[12px] leading-relaxed text-slate-500">Choose a demo role to explore the complaint management workspace.</p></div><div className="flex flex-col gap-3"><button onClick={() => onLogin('Manager')} className="login-role"><div className="flex size-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700"><ShieldCheck className="size-[18px]" /></div><div className="flex-1 text-left"><div className="text-[12px] font-semibold text-slate-800">Continue as Manager</div><div className="mt-1 text-[10px] text-slate-500">Team oversight, escalations & analytics</div></div><span className="text-blue-600">→</span></button><button onClick={() => onLogin('Agent')} className="login-role"><div className="flex size-10 items-center justify-center rounded-lg bg-slate-100 text-slate-600"><CircleHelp className="size-[18px]" /></div><div className="flex-1 text-left"><div className="text-[12px] font-semibold text-slate-800">Continue as Agent</div><div className="mt-1 text-[10px] text-slate-500">Complaint queue & response review</div></div><span className="text-slate-400">→</span></button></div><div className="mt-6 rounded-md border border-amber-100 bg-amber-50/70 px-3 py-2.5 text-[10px] leading-relaxed text-amber-900"><span className="font-semibold">Demo only.</span> No real banking accounts, customer data, or message delivery are connected.</div><div className="mt-7 border-t border-slate-100 pt-4 text-center text-[10px] text-slate-400">Secure operations experience · Simulation environment</div></div><div className="login-footer">© 2026 360° Resolver <span className="mx-2">·</span> Internal hackathon prototype</div></main>
}

export function ResolverApp({ workspace, initialAuthError }: { workspace: ResolverWorkspace; initialAuthError?: string }) {
  const router = useRouter()
  const profile = workspace.profile
  const role: UserRole = profile?.role ?? 'Agent'
  const [view, setView] = useState<ViewKey>('dashboard')
  const [detailId, setDetailId] = useState<string | null>(null)
  const [complaints, setComplaints] = useState<Complaint[]>(workspace.complaints)
  const [globalSearch, setGlobalSearch] = useState('')
  const [inboxQuery, setInboxQuery] = useState('')
  const [inboxFilter, setInboxFilter] = useState('')
  const [duplicateDecisions, setDuplicateDecisions] = useState(workspace.duplicateDecisions)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [operationError, setOperationError] = useState('')

  const navigate = (nextView: ViewKey) => { setView(nextView); setDetailId(null); setMobileMenuOpen(false); if (nextView === 'inbox') { setInboxFilter(''); setInboxQuery('') } }
  const selectComplaint = (id: string) => { setDetailId(id); setView('inbox'); setMobileMenuOpen(false) }
  const updateComplaint = async (id: string, changes: Partial<Complaint>) => {
    try {
      setOperationError('')
      const savedChanges = await updateComplaintAction(id, changes)
      setComplaints((current) => current.map((item) => item.id === id ? { ...item, ...savedChanges } : item))
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : 'The complaint could not be saved.')
    }
  }
  const decideDuplicate = async (key: string, decision: 'confirmed' | 'rejected') => {
    const [first, second] = key.split(':')
    try {
      setOperationError('')
      await saveDuplicateDecisionAction(first, second, decision)
      setDuplicateDecisions((current) => ({ ...current, [key]: decision }))
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : 'The duplicate decision could not be saved.')
    }
  }
  const selected = complaints.find((item) => item.id === detailId)
  const activeView = view
  const submitSearch = (event: React.FormEvent<HTMLFormElement>) => { event.preventDefault(); setInboxQuery(globalSearch); setInboxFilter(''); setView('inbox'); setDetailId(null) }
  const applyMetricFilter = (filter: 'all' | 'open' | 'high' | 'risk') => { setInboxQuery(''); setInboxFilter(filter); setView('inbox'); setDetailId(null) }
  const createComplaint = async (details: Pick<Complaint, 'subject' | 'customerRef' | 'channel' | 'category' | 'severity' | 'message'>) => {
    setOperationError('')
    const created = await createComplaintAction(details)
    setComplaints((current) => [created, ...current])
    setInboxQuery('')
    setInboxFilter('')
    return created
  }

  if (!profile) return <AuthScreen initialError={initialAuthError ?? workspace.error} />

  return <div className="app-frame">
    {mobileMenuOpen && <button aria-label="Close navigation" className="mobile-backdrop" onClick={() => setMobileMenuOpen(false)} />}
    <div className={`app-sidebar ${mobileMenuOpen ? 'mobile-sidebar-open' : ''}`}><Sidebar active={activeView} role={role} openCount={complaints.filter((item) => item.status !== 'Resolved').length} onNavigate={navigate} onLogout={() => { void createClient().auth.signOut().then((result: { error: Error | null }) => { if (result.error) setOperationError('Could not sign out. Try again.'); else router.refresh() }) }} /></div>
    <div className="app-content min-w-0 flex-1">
      {operationError && <div role="alert" className="border-b border-rose-200 bg-rose-50 px-5 py-2 text-[11px] text-rose-800">{operationError}</div>}
      <header className="topbar"><div className="flex min-w-0 items-center gap-3"><button className="mobile-menu-trigger" aria-label="Open navigation" onClick={() => setMobileMenuOpen(true)}><span /><span /><span /></button><span className="topbar-section">{selected ? 'Complaint details' : navigation.find((item) => item.key === view)?.label}</span><span className="topbar-divider hidden sm:block" /><span className="hidden text-[10px] text-slate-400 sm:block">Operations workspace</span></div>
        <div className="flex items-center gap-2.5"><form onSubmit={submitSearch} className="global-search"><Search className="size-3.5 text-slate-400" /><input value={globalSearch} onChange={(e) => setGlobalSearch(e.target.value)} placeholder="Search cases..." aria-label="Global complaint search" /><kbd>⌘ K</kbd></form><div className="relative"><button className={`topbar-icon ${showNotifications ? 'bg-slate-100' : ''}`} onClick={() => { setShowNotifications(!showNotifications); setShowProfile(false) }} aria-label="Notifications"><Bell className="size-[17px]" /><i className="notification-dot" /></button>{showNotifications && <div className="topbar-popover right-0"><div className="flex items-center justify-between border-b border-slate-100 px-3.5 py-3"><span className="text-[11px] font-semibold text-slate-800">Notifications</span><span className="rounded bg-amber-50 px-1.5 py-0.5 text-[9px] text-amber-700">2 attention</span></div><button onClick={() => { setShowNotifications(false); navigate('sla') }} className="flex w-full gap-2.5 p-3.5 text-left hover:bg-slate-50"><span className="mt-0.5 size-2 rounded-full bg-rose-500" /><span><span className="block text-[10px] font-medium text-slate-800">SLA deadline approaching</span><span className="mt-1 block text-[9px] text-slate-500">CMP-28470 · 26 minutes remaining</span></span></button><button onClick={() => { setShowNotifications(false); navigate('duplicates') }} className="flex w-full gap-2.5 border-t border-slate-100 p-3.5 text-left hover:bg-slate-50"><span className="mt-0.5 size-2 rounded-full bg-amber-500" /><span><span className="block text-[10px] font-medium text-slate-800">Potential duplicate identified</span><span className="mt-1 block text-[9px] text-slate-500">CMP-28491 may match another case</span></span></button></div>}</div><div className="topbar-profile-wrap"><button className="profile-trigger" onClick={() => { setShowProfile(!showProfile); setShowNotifications(false) }} aria-expanded={showProfile}><span className="profile-avatar">{role === 'Manager' ? 'PS' : 'MC'}</span><span className="hidden text-left sm:block"><span className="block text-[10px] font-semibold text-slate-800">{role === 'Manager' ? 'Priya Shah' : 'Marcus Chen'}</span><span className="block text-[9px] text-slate-400">{role}</span></span><ChevronDown className="hidden size-3 text-slate-400 sm:block" /></button>{showProfile && <div className="topbar-popover right-0 w-48 p-1.5"><div className="px-2.5 py-2"><div className="text-[10px] font-semibold text-slate-800">Switch demo view</div><div className="mt-0.5 text-[9px] text-slate-400">Role-based workspace preview</div></div><button onClick={() => { setShowProfile(false); setShowProfile(false) }} className="profile-menu-item">Priya Shah <span>Manager</span></button><button onClick={() => { setShowProfile(false); setShowProfile(false) }} className="profile-menu-item">Marcus Chen <span>Agent</span></button></div>}</div></div>
      </header>
      <main className="workspace-main">
        {selected ? <ComplaintDetailView complaint={selected} complaints={complaints} team={workspace.team} onDuplicateDecision={(key, decision) => { void decideDuplicate(key, decision) }} onBack={() => { setDetailId(null); setView('inbox') }} onUpdate={updateComplaint} />
          : view === 'dashboard' ? <DashboardView complaints={complaints} role={role} displayName={profile.displayName} onNavigate={navigate} onMetricFilter={applyMetricFilter} onSelectComplaint={selectComplaint} />
          : view === 'inbox' ? <InboxView complaints={complaints} initialFilter={inboxFilter} searchTerm={inboxQuery} onSelectComplaint={selectComplaint} onNavigate={() => navigate('new')} />
          : view === 'new' ? <NewComplaintView onCreate={createComplaint} onCancel={() => navigate('inbox')} />
          : view === 'sla' ? <SlaEscalationsView complaints={complaints} onSelectComplaint={selectComplaint} />
          : view === 'duplicates' ? <DuplicateClustersView complaints={complaints} decisions={duplicateDecisions} onDecision={(key, decision) => { void decideDuplicate(key, decision) }} onSelectComplaint={selectComplaint} />
          : view === 'analytics' ? <AnalyticsView complaints={complaints} />
          : view === 'knowledge' ? <KnowledgeBaseView articles={workspace.articles} />
          : view === 'team' ? <TeamManagementView role={role} complaints={complaints} team={workspace.team} currentUserName={profile.displayName} onSelectComplaint={selectComplaint} />
          : <SettingsView />}
      </main>
      <footer className="workspace-footer"><span>© 2026 360° Resolver</span><span className="footer-dot" />Supabase Auth · Persistent workspace records<span className="ml-auto">v0.1 prototype</span></footer>
    </div>
  </div>
}
