'use client'

import { ArrowDownRight, ArrowRight, ArrowUpRight, Clock3, Ellipsis, Plus, Sparkles, UsersRound, CircleAlert, CheckCircle2 } from 'lucide-react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Button } from '@/components/ui/button'
import { categoryData, channelData, formatSla, isAtRisk, volumeData, type Complaint } from './types'

function Panel({ title, description, action, children, className = '' }: { title: string; description?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return <section className={`panel-card ${className}`}><div className="flex items-start justify-between gap-3 px-5 pt-4"><div><h2 className="text-[13px] font-semibold text-slate-900">{title}</h2>{description && <p className="mt-1 text-[11px] text-slate-500">{description}</p>}</div>{action}</div><div className="px-5 pb-4 pt-4">{children}</div></section>
}

const severityClass: Record<string, string> = { Critical: 'severity-critical', High: 'severity-high', Medium: 'severity-medium', Low: 'severity-low' }

export function DashboardView({ complaints, onNavigate, onMetricFilter, onSelectComplaint, role }: { complaints: Complaint[]; onNavigate: (view: 'inbox' | 'new' | 'sla' | 'analytics') => void; onMetricFilter: (filter: 'all' | 'open' | 'high' | 'risk') => void; onSelectComplaint: (id: string) => void; role: string }) {
  const open = complaints.filter((item) => item.status !== 'Resolved').length
  const risk = complaints.filter(isAtRisk).length
  const highSeverity = complaints.filter((item) => item.severity === 'Critical' || item.severity === 'High').length
  const recent = [...complaints].slice(0, 5)
  const atRisk = complaints.filter(isAtRisk).sort((a, b) => a.minutesToSla - b.minutesToSla).slice(0, 4)
  const unassigned = complaints.filter((item) => item.assignedTo === 'Unassigned').slice(0, 3)
  const metrics = [
    { label: 'Total complaints', value: '1,284', delta: '+8.2%', note: 'vs. previous 7 days', trend: 'up', filter: 'all', icon: 'total' },
    { label: 'Open cases', value: String(265 + open), delta: '−4.6%', note: 'vs. previous 7 days', trend: 'down', filter: 'open', icon: 'open' },
    { label: 'High severity', value: String(18 + highSeverity), delta: '+2', note: 'needs manager attention', trend: 'up', filter: 'high', icon: 'high' },
    { label: 'SLA at risk', value: String(7 + risk), delta: '2 urgent', note: 'due within 2 hours', trend: 'risk', filter: 'risk', icon: 'risk' },
  ]
  return <div className="flex flex-col gap-5">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><div className="flex items-center gap-2"><h1 className="text-[23px] font-semibold tracking-[-0.04em] text-slate-950">Good morning, {role === 'Manager' ? 'Priya' : 'Marcus'}</h1><span className="demo-tag"><span className="size-1.5 rounded-full bg-emerald-500" />DEMO DATA</span></div><p className="mt-1 text-[12px] text-slate-500">Here’s what’s happening across complaint operations today.</p></div>
      <Button onClick={() => onNavigate('new')} className="h-9 rounded-md bg-[#2459c5] px-3.5 text-[12px] hover:bg-[#1d4ca8]"><Plus data-icon="inline-start" />New complaint</Button>
    </div>
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {metrics.map((metric) => <button key={metric.label} onClick={() => onMetricFilter(metric.filter as 'all' | 'open' | 'high' | 'risk')} className="metric-card group text-left">
        <div className="flex items-center justify-between"><span className="text-[11px] font-medium text-slate-500">{metric.label}</span><Ellipsis className="size-4 text-slate-400" /></div>
        <div className="mt-3 flex items-baseline gap-2"><span className="text-[25px] font-semibold tracking-[-0.04em] text-slate-950">{metric.value}</span><span className={`inline-flex items-center text-[10px] font-medium ${metric.trend === 'risk' ? 'text-amber-700' : metric.trend === 'down' ? 'text-emerald-700' : 'text-blue-700'}`}>{metric.trend === 'down' ? <ArrowDownRight className="mr-0.5 size-3" /> : <ArrowUpRight className="mr-0.5 size-3" />}{metric.delta}</span></div>
        <div className="mt-1 text-[10px] text-slate-400">{metric.note}</div>
      </button>)}
    </div>
    <div className="grid gap-4 xl:grid-cols-[1.65fr_1fr]">
      <Panel title="Complaint volume" description="Incoming vs. resolved · last 7 days" action={<button onClick={() => onNavigate('inbox')} className="text-[11px] font-medium text-blue-700 hover:text-blue-900">View reports <ArrowRight className="ml-1 inline size-3" /></button>}>
        <div className="h-[207px] w-full"><ResponsiveContainer width="100%" height="100%"><AreaChart data={volumeData} margin={{ top: 5, right: 2, left: -22, bottom: 0 }}><defs><linearGradient id="receivedFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4d7ed9" stopOpacity={0.15} /><stop offset="95%" stopColor="#4d7ed9" stopOpacity={0} /></linearGradient><linearGradient id="resolvedFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#9baac2" stopOpacity={0.15} /><stop offset="95%" stopColor="#9baac2" stopOpacity={0} /></linearGradient></defs><CartesianGrid vertical={false} stroke="#edf0f4" /><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#8691a2', fontSize: 10 }} dy={8} /><YAxis axisLine={false} tickLine={false} tick={{ fill: '#8691a2', fontSize: 10 }} /><Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e3e8ef', fontSize: 11, boxShadow: '0 8px 24px rgba(20,35,60,.08)' }} /><Area type="monotone" dataKey="received" name="Received" stroke="#4675d1" strokeWidth={2} fill="url(#receivedFill)" /><Area type="monotone" dataKey="resolved" name="Resolved" stroke="#93a1b7" strokeWidth={2} fill="url(#resolvedFill)" /></AreaChart></ResponsiveContainer></div>
        <div className="mt-1 flex gap-5 text-[10px] text-slate-500"><span><i className="mr-1.5 inline-block size-2 rounded-full bg-[#4675d1]" />Received</span><span><i className="mr-1.5 inline-block size-2 rounded-full bg-[#93a1b7]" />Resolved</span></div>
      </Panel>
      <Panel title="Complaints by category" description="Current open cases" action={<button onClick={() => onNavigate('analytics')} aria-label="Open analytics"><Ellipsis className="size-4 text-slate-400" /></button>}>
        <div className="flex flex-col gap-3.5 pt-1">{categoryData.map((item) => <div key={item.name}><div className="mb-1.5 flex justify-between text-[10px]"><span className="text-slate-600">{item.name}</span><span className="font-medium text-slate-700">{item.value}%</span></div><div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full" style={{ width: `${item.value * 2.3}%`, backgroundColor: item.color }} /></div></div>)}</div>
        <div className="mt-4 border-t border-slate-100 pt-3"><div className="mb-2 flex items-center justify-between text-[9px] font-semibold tracking-wide text-slate-500"><span>CHANNEL DISTRIBUTION</span><span className="font-normal normal-case tracking-normal text-slate-400">7-day sample</span></div><div className="flex h-2 overflow-hidden rounded-full bg-slate-100">{channelData.map((item, index) => <span key={item.name} aria-label={`${item.name}: ${item.value}%`} title={`${item.name}: ${item.value}%`} style={{ width: `${item.value}%`, backgroundColor: ['#315fce', '#5482df', '#7aa0ea', '#a4beef', '#d0dcf4'][index] }} />)}</div><div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">{channelData.map((item, index) => <div key={item.name} className="flex items-center gap-1.5 text-[9px] text-slate-500"><span className="size-1.5 rounded-full" style={{ backgroundColor: ['#315fce', '#5482df', '#7aa0ea', '#a4beef', '#d0dcf4'][index] }} />{item.name}<span className="ml-auto text-slate-700">{item.value}%</span></div>)}</div></div>
      </Panel>
    </div>
    <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
      <Panel title="Recent complaints" description="Latest cases from all channels" action={<button onClick={() => onNavigate('inbox')} className="text-[11px] font-medium text-blue-700 hover:text-blue-900">View inbox <ArrowRight className="ml-1 inline size-3" /></button>}>
        <div className="overflow-x-auto"><table className="data-table min-w-[620px]"><thead><tr><th>Complaint</th><th>Category</th><th>Severity</th><th>Status</th><th>SLA left</th></tr></thead><tbody>{recent.map((item) => <tr key={item.id} onClick={() => onSelectComplaint(item.id)} className="cursor-pointer"><td><div className="font-medium text-slate-800">{item.subject}</div><div className="mt-1 text-[10px] text-slate-400">{item.id} · {item.channel}</div></td><td>{item.category}</td><td><span className={`severity-badge ${severityClass[item.severity]}`}>{item.severity}</span></td><td><span className="status-dot-label"><i className={`size-1.5 rounded-full ${item.status === 'Resolved' ? 'bg-emerald-500' : item.status === 'In progress' ? 'bg-blue-500' : 'bg-amber-500'}`} />{item.status}</span></td><td className={item.minutesToSla <= 60 ? 'font-semibold text-rose-600' : 'text-slate-600'}>{formatSla(item.minutesToSla)}</td></tr>)}</tbody></table></div>
      </Panel>
      <Panel title="SLA risk queue" description="Cases needing timely attention" action={<button onClick={() => onNavigate('sla')} className="text-[11px] font-medium text-blue-700 hover:text-blue-900">See all <ArrowRight className="ml-1 inline size-3" /></button>}>
        <div className="flex flex-col">{atRisk.map((item) => <button key={item.id} onClick={() => onSelectComplaint(item.id)} className="flex items-start gap-3 border-b border-slate-100 py-3 text-left last:border-0"><div className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md ${item.minutesToSla <= 60 ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-700'}`}><Clock3 className="size-3.5" /></div><div className="min-w-0 flex-1"><div className="truncate text-[11px] font-medium text-slate-800">{item.subject}</div><div className="mt-1 text-[10px] text-slate-400">{item.id} · {item.assignedTo}</div></div><div className={`whitespace-nowrap text-[10px] font-semibold ${item.minutesToSla <= 60 ? 'text-rose-600' : 'text-amber-700'}`}>{formatSla(item.minutesToSla)}</div></button>)}{atRisk.length === 0 && <div className="py-5 text-center text-xs text-slate-500">No active cases at risk.</div>}</div>
      </Panel>
    </div>
    <div className="grid gap-4 md:grid-cols-2">
      <div className="flex items-center gap-3 rounded-lg border border-blue-100 bg-blue-50/70 px-4 py-3"><div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-white text-blue-700"><Sparkles className="size-4" /></div><div className="min-w-0 flex-1"><div className="text-[11px] font-semibold text-slate-800">AI triage is simulated</div><div className="mt-0.5 text-[10px] text-slate-500">Classification and drafts are demo suggestions for agent review.</div></div><span className="rounded bg-blue-100 px-2 py-1 text-[9px] font-semibold tracking-wide text-blue-700">DEMO</span></div>
      <button onClick={() => onNavigate('inbox')} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-left hover:border-blue-200"><div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-amber-50 text-amber-700"><UsersRound className="size-4" /></div><div className="min-w-0 flex-1"><div className="text-[11px] font-semibold text-slate-800">Unassigned cases <span className="ml-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] text-amber-800">{unassigned.length}</span></div><div className="mt-0.5 truncate text-[10px] text-slate-500">{unassigned.map((item) => item.id).join(' · ') || 'All cases have an owner'}</div></div><CircleAlert className="size-4 shrink-0 text-slate-400" /></button>
    </div>
  </div>
}

export function DashboardPageTitle() { return <CheckCircle2 className="sr-only" aria-hidden="true" /> }
