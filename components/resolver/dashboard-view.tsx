'use client'

import { ArrowDownRight, ArrowRight, ArrowUpRight, Clock3, Ellipsis, Plus, Sparkles, UsersRound, CircleAlert, CheckCircle2, ChevronRight } from 'lucide-react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Button } from '@/components/ui/button'
import { buildDailyComplaintVolume, formatSla, isAtRisk, type Complaint, type SlaRules } from './types'

function Panel({ title, description, action, children, className = '' }: { title: string; description?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return <section className={`panel-card ${className}`}><div className="flex items-start justify-between gap-3 px-5 pt-5"><div><h2 className="text-[14px] font-semibold tracking-[-0.01em] text-slate-900">{title}</h2>{description && <p className="mt-1 text-[12px] text-slate-500">{description}</p>}</div>{action}</div><div className="px-5 pb-5 pt-4">{children}</div></section>
}

const severityClass: Record<string, string> = { Critical: 'severity-critical', High: 'severity-high', Medium: 'severity-medium', Low: 'severity-low' }

export function DashboardView({ complaints, slaRules, onNavigate, onMetricFilter, onSelectComplaint, role, displayName }: { complaints: Complaint[]; slaRules: SlaRules; onNavigate: (view: 'inbox' | 'new' | 'sla' | 'analytics') => void; onMetricFilter: (filter: 'all' | 'open' | 'high' | 'risk') => void; onSelectComplaint: (id: string) => void; role: string; displayName: string }) {
  const open = complaints.filter((item) => item.status !== 'Resolved').length
  const volumeData = buildDailyComplaintVolume(complaints)
  const risk = complaints.filter(isAtRisk).length
  const highSeverity = complaints.filter((item) => item.severity === 'Critical' || item.severity === 'High').length
  const recent = [...complaints].slice(0, 5)
  const atRisk = complaints.filter(isAtRisk).sort((a, b) => a.minutesToSla - b.minutesToSla).slice(0, 4)
  const unassigned = complaints.filter((item) => item.assignedTo === 'Unassigned').slice(0, 3)
  const categoryData = Object.entries(complaints.filter((item) => item.status !== 'Resolved').reduce<Record<string, number>>((counts, item) => ({ ...counts, [item.category]: (counts[item.category] ?? 0) + 1 }), {}))
    .map(([name, count]) => ({ name, count, value: open ? Math.round((count / open) * 100) : 0 }))
    .sort((a, b) => b.count - a.count).slice(0, 5)
  const channelCounts = complaints.reduce<Record<string, number>>((counts, item) => ({ ...counts, [item.channel]: (counts[item.channel] ?? 0) + 1 }), {})
  const channelData = Object.entries(channelCounts).map(([name, count]) => ({ name, count, value: complaints.length ? Math.round((count / complaints.length) * 100) : 0 })).sort((a, b) => b.count - a.count)
  const chartColors = ['#1f4f9a', '#3d70bb', '#6893cf', '#94b5df', '#bed0e8']
  const metrics = [
    { label: 'Total complaints', value: complaints.length, delta: `${volumeData.reduce((sum, day) => sum + day.received, 0)} this week`, note: 'stored complaint records', trend: 'up', filter: 'all' },
    { label: 'Open cases', value: open, delta: `${complaints.length ? Math.round((open / complaints.length) * 100) : 0}% of total`, note: 'not yet resolved', trend: 'down', filter: 'open' },
    { label: 'High severity', value: highSeverity, delta: `${complaints.length ? Math.round((highSeverity / complaints.length) * 100) : 0}% of total`, note: 'critical and high priority', trend: 'up', filter: 'high' },
    { label: 'SLA at risk', value: risk, delta: `${atRisk.length} shown`, note: `escalation at ${slaRules.escalationElapsedPercent}% elapsed`, trend: 'risk', filter: 'risk' },
  ]
  return <div className="flex flex-col gap-6">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><div className="flex items-center gap-2"><h1 className="text-[26px] font-semibold tracking-[-0.035em] text-slate-950">Good morning, {displayName.split(' ')[0]}</h1><span className="demo-tag"><span className="size-1.5 rounded-full bg-emerald-500" />WORKSPACE DATA</span></div><p className="mt-1 text-[12px] text-slate-500">Here’s what’s happening across complaint operations today.</p></div>
      <Button onClick={() => onNavigate('new')} className="h-9 rounded-md bg-[#2459c5] px-3.5 text-[12px] hover:bg-[#1d4ca8]"><Plus data-icon="inline-start" />New complaint</Button>
    </div>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {metrics.map((metric) => <button key={metric.label} type="button" aria-label={`View ${metric.label.toLowerCase()}: ${metric.value} complaints`} onClick={() => onMetricFilter(metric.filter as 'all' | 'open' | 'high' | 'risk')} className="metric-card group text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">
        <div className="flex items-center justify-between"><span className="text-[12px] font-medium text-slate-600">{metric.label}</span><ChevronRight className="size-4 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-blue-700" /></div>
        <div className="mt-3 flex items-baseline gap-2"><span className="text-[29px] font-semibold tabular-nums tracking-[-0.04em] text-[#14233b]">{metric.value}</span><span className={`inline-flex items-center text-[10px] font-semibold ${metric.trend === 'risk' ? 'text-amber-700' : metric.trend === 'down' ? 'text-emerald-700' : 'text-blue-700'}`}>{metric.trend === 'down' ? <ArrowDownRight className="mr-0.5 size-3" /> : metric.trend === 'risk' ? <Clock3 className="mr-1 size-3" /> : <ArrowUpRight className="mr-0.5 size-3" />}{metric.delta}</span></div>
        <div className="mt-1.5 text-[11px] text-slate-500">{metric.note}</div>
      </button>)}
    </div>
    <div className="grid gap-4 lg:grid-cols-[1.55fr_1fr]">
      <Panel title="Complaint volume" description="Incoming and resolved · last 7 days" action={<button onClick={() => onNavigate('analytics')} className="text-[11px] font-semibold text-blue-800 hover:text-blue-950">View analytics <ArrowRight className="ml-1 inline size-3" /></button>}>
        <div className="h-[224px] w-full"><ResponsiveContainer width="100%" height="100%"><AreaChart data={volumeData} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}><defs><linearGradient id="receivedFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4d7ed9" stopOpacity={0.15} /><stop offset="95%" stopColor="#4d7ed9" stopOpacity={0} /></linearGradient><linearGradient id="resolvedFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#9baac2" stopOpacity={0.15} /><stop offset="95%" stopColor="#9baac2" stopOpacity={0} /></linearGradient></defs><CartesianGrid vertical={false} stroke="#edf0f4" /><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#66758a', fontSize: 11 }} dy={8} /><YAxis axisLine={false} tickLine={false} tick={{ fill: '#66758a', fontSize: 11 }} width={34} /><Tooltip contentStyle={{ borderRadius: 7, border: '1px solid #dce3ec', fontSize: 11, boxShadow: '0 8px 24px rgba(20,35,60,.08)' }} /><Area type="monotone" dataKey="received" name="Received" stroke="#315f9f" strokeWidth={2.5} activeDot={{ r: 4, strokeWidth: 0 }} fill="url(#receivedFill)" /><Area type="monotone" dataKey="resolved" name="Resolved" stroke="#8798ae" strokeWidth={2.5} activeDot={{ r: 4, strokeWidth: 0 }} fill="url(#resolvedFill)" /></AreaChart></ResponsiveContainer></div>
        <div className="mt-1 flex gap-5 text-[10px] text-slate-500"><span><i className="mr-1.5 inline-block size-2 rounded-full bg-[#4675d1]" />Received</span><span><i className="mr-1.5 inline-block size-2 rounded-full bg-[#93a1b7]" />Resolved</span></div>
      </Panel>
      <Panel title="Complaints by category" description="Current open cases" action={<button onClick={() => onNavigate('analytics')} aria-label="Open analytics"><Ellipsis className="size-4 text-slate-400" /></button>}>
        <div className="flex flex-col gap-3.5 pt-1">{categoryData.map((item, index) => <div key={item.name}><div className="mb-1.5 flex justify-between gap-3 text-[11px]"><span className="truncate text-slate-700">{item.name}</span><span className="shrink-0 font-medium tabular-nums text-slate-600">{item.count} <span className="font-normal text-slate-400">· {item.value}%</span></span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full" style={{ width: `${categoryData[0]?.count ? Math.max(8, (item.count / categoryData[0].count) * 100) : 0}%`, backgroundColor: chartColors[index] }} /></div></div>)}</div>
        <div className="mt-5 border-t border-slate-100 pt-4"><div className="mb-2.5 flex items-center justify-between text-[10px] font-semibold tracking-wide text-slate-600"><span>INTAKE CHANNELS</span><span className="font-normal normal-case tracking-normal text-slate-500">{complaints.length} demo cases</span></div><div className="flex h-2 overflow-hidden rounded-full bg-slate-100">{channelData.map((item, index) => <span key={item.name} aria-label={`${item.name}: ${item.count} cases, ${item.value}%`} title={`${item.name}: ${item.count} cases (${item.value}%)`} style={{ width: `${item.value}%`, backgroundColor: chartColors[index % chartColors.length] }} />)}</div><div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">{channelData.map((item, index) => <div key={item.name} className="flex min-w-0 items-center gap-2 text-[10px] text-slate-600"><span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: chartColors[index % chartColors.length] }} /><span className="truncate">{item.name}</span><span className="ml-auto shrink-0 tabular-nums text-slate-800">{item.count} <span className="text-slate-400">({item.value}%)</span></span></div>)}</div></div>
      </Panel>
    </div>
    <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
      <Panel title="Recent complaints" description="Latest cases from all channels" action={<button onClick={() => onNavigate('inbox')} className="text-[11px] font-medium text-blue-700 hover:text-blue-900">View inbox <ArrowRight className="ml-1 inline size-3" /></button>}>
        <div className="overflow-x-auto"><table className="data-table min-w-[540px]"><thead><tr><th>Complaint</th><th>Category</th><th>Severity</th><th>Status</th><th>SLA left</th></tr></thead><tbody>{recent.map((item) => <tr key={item.id} onClick={() => onSelectComplaint(item.id)} className="cursor-pointer"><td><div className="font-medium text-slate-800">{item.subject}</div><div className="mt-1 text-[10px] text-slate-400">{item.id} · {item.channel}</div></td><td>{item.category}</td><td><span className={`severity-badge ${severityClass[item.severity]}`}>{item.severity}</span></td><td><span className="status-dot-label"><i className={`size-1.5 rounded-full ${item.status === 'Resolved' ? 'bg-emerald-500' : item.status === 'In progress' ? 'bg-blue-500' : 'bg-amber-500'}`} />{item.status}</span></td><td className={item.minutesToSla <= 60 ? 'font-semibold text-rose-600' : 'text-slate-600'}>{formatSla(item.minutesToSla)}</td></tr>)}</tbody></table></div>
      </Panel>
      <Panel title="SLA risk queue" description="Cases needing timely attention" action={<button onClick={() => onNavigate('sla')} className="text-[11px] font-medium text-blue-700 hover:text-blue-900">See all <ArrowRight className="ml-1 inline size-3" /></button>}>
        <div className="flex flex-col">{atRisk.map((item) => <button key={item.id} onClick={() => onSelectComplaint(item.id)} className="flex items-start gap-3 border-b border-slate-100 py-3 text-left last:border-0"><div className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md ${item.minutesToSla <= 60 ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-700'}`}><Clock3 className="size-3.5" /></div><div className="min-w-0 flex-1"><div className="truncate text-[12px] font-medium text-slate-800">{item.subject}</div><div className="mt-1 text-[11px] text-slate-500">{item.id} · {item.assignedTo}</div></div><div className={`whitespace-nowrap text-[10px] font-semibold ${item.minutesToSla <= 60 ? 'text-rose-600' : 'text-amber-700'}`}>{formatSla(item.minutesToSla)}</div></button>)}{atRisk.length === 0 && <div className="py-5 text-center text-xs text-slate-500">No active cases at risk.</div>}</div>
      </Panel>
    </div>
    <div className="grid gap-4 md:grid-cols-2">
      <div className="flex items-center gap-3 rounded-lg border border-blue-100 bg-blue-50/70 px-4 py-3"><div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-white text-blue-700"><Sparkles className="size-4" /></div><div className="min-w-0 flex-1"><div className="text-[11px] font-semibold text-slate-800">AI triage is simulated</div><div className="mt-0.5 text-[10px] text-slate-500">Classification and drafts are demo suggestions for agent review.</div></div><span className="rounded bg-blue-100 px-2 py-1 text-[9px] font-semibold tracking-wide text-blue-700">DEMO</span></div>
      <button onClick={() => onNavigate('inbox')} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-left hover:border-blue-200"><div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-amber-50 text-amber-700"><UsersRound className="size-4" /></div><div className="min-w-0 flex-1"><div className="text-[11px] font-semibold text-slate-800">Unassigned cases <span className="ml-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] text-amber-800">{unassigned.length}</span></div><div className="mt-0.5 truncate text-[10px] text-slate-500">{unassigned.map((item) => item.id).join(' · ') || 'All cases have an owner'}</div></div><CircleAlert className="size-4 shrink-0 text-slate-400" /></button>
    </div>
  </div>
}

export function DashboardPageTitle() { return <CheckCircle2 className="sr-only" aria-hidden="true" /> }
