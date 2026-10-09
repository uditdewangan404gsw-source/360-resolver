'use client'

import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { buildDailyComplaintVolume, isAtRisk, isSlaBreached, type Complaint } from './types'

const chartColors = ['#315f9f', '#5482bd', '#7aa0cc', '#a6bfdc', '#cad8e8']

function Panel({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <section className="panel-card"><div className="px-5 pt-4"><h2 className="text-[13px] font-semibold text-slate-800">{title}</h2><p className="mt-1 text-[10px] text-slate-500">{description}</p></div><div className="h-[270px] p-4">{children}</div></section>
}

export function AnalyticsView({ complaints }: { complaints: Complaint[] }) {
  const volume = buildDailyComplaintVolume(complaints)
  const open = complaints.filter((complaint) => complaint.status !== 'Resolved')
  const resolved = complaints.filter((complaint) => complaint.resolvedAt)
  const negativeSentiment = complaints.filter((complaint) => complaint.sentiment === 'Frustrated' || complaint.sentiment === 'Negative').length
  const categoryCounts = Object.entries(complaints.reduce<Record<string, number>>((counts, complaint) => {
    counts[complaint.category] = (counts[complaint.category] ?? 0) + 1
    return counts
  }, {})).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 5)
  const channelCounts = Object.entries(complaints.reduce<Record<string, number>>((counts, complaint) => {
    counts[complaint.channel] = (counts[complaint.channel] ?? 0) + 1
    return counts
  }, {})).map(([name, value]) => ({ name, value }))
  const sevenDayReceived = volume.reduce((sum, day) => sum + day.received, 0)
  const atRiskCount = complaints.filter(isAtRisk).length
  const breachedCount = complaints.filter(isSlaBreached).length
  const topCategory = categoryCounts[0]

  return <div className="flex flex-col gap-5">
    <div><div className="flex flex-wrap items-center gap-2"><h1 className="text-[23px] font-semibold tracking-[-0.04em] text-slate-950">Trends &amp; analytics</h1><span className="demo-tag"><span className="size-1.5 rounded-full bg-emerald-500" />STORED COMPLAINT DATA</span></div><p className="mt-1 text-[12px] text-slate-500">Operational patterns calculated from the complaint records in this workspace.</p></div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><div className="metric-card"><div className="text-[10px] text-slate-500">Received · last 7 days</div><div className="mt-2 text-2xl font-semibold text-slate-900">{sevenDayReceived}</div><div className="mt-1 text-[10px] text-slate-400">From saved received timestamps</div></div><div className="metric-card"><div className="text-[10px] text-slate-500">Open complaints</div><div className="mt-2 text-2xl font-semibold text-slate-900">{open.length}</div><div className="mt-1 text-[10px] text-slate-400">Across all current statuses</div></div><div className="metric-card"><div className="text-[10px] text-slate-500">SLA at risk / breached</div><div className="mt-2 text-2xl font-semibold text-amber-700">{atRiskCount} <span className="text-slate-400">/</span> <span className="text-rose-700">{breachedCount}</span></div><div className="mt-1 text-[10px] text-slate-400">Calculated from due timestamps</div></div><div className="metric-card"><div className="text-[10px] text-slate-500">Negative / frustrated</div><div className="mt-2 text-2xl font-semibold text-slate-900">{negativeSentiment}</div><div className="mt-1 text-[10px] text-slate-400">Of {complaints.length} stored complaints</div></div></div>
    <div className="grid gap-4 xl:grid-cols-2">
      <Panel title="Received and resolved" description="Daily counts · last seven calendar days"><ResponsiveContainer width="100%" height="100%"><BarChart data={volume} margin={{ top: 12, right: 8, left: -18, bottom: 0 }}><CartesianGrid vertical={false} stroke="#edf0f4" /><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#7d8796', fontSize: 10 }} /><YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: '#7d8796', fontSize: 10 }} /><Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e3e8ef', fontSize: 10 }} /><Bar dataKey="received" name="Received" fill="#4675d1" radius={[4, 4, 0, 0]} barSize={18} /><Bar dataKey="resolved" name="Resolved" fill="#a8b4c6" radius={[4, 4, 0, 0]} barSize={18} /></BarChart></ResponsiveContainer></Panel>
      <Panel title="Complaints by category" description="All stored complaint records"><ResponsiveContainer width="100%" height="100%"><BarChart data={categoryCounts} layout="vertical" margin={{ top: 4, right: 12, left: 10, bottom: 0 }}><CartesianGrid horizontal={false} stroke="#edf0f4" /><XAxis type="number" allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: '#7d8796', fontSize: 10 }} /><YAxis type="category" dataKey="name" width={112} axisLine={false} tickLine={false} tick={{ fill: '#58677c', fontSize: 10 }} /><Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e3e8ef', fontSize: 10 }} /><Bar dataKey="count" name="Complaints" radius={[0, 4, 4, 0]}>{categoryCounts.map((item, index) => <Cell key={item.name} fill={chartColors[index % chartColors.length]} />)}</Bar></BarChart></ResponsiveContainer>{!categoryCounts.length && <p className="-mt-36 text-center text-xs text-slate-500">No complaint data yet.</p>}</Panel>
      <Panel title="Intake channels" description="Share of stored complaint records"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={channelCounts} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={56} outerRadius={92} paddingAngle={3}>{channelCounts.map((item, index) => <Cell key={item.name} fill={chartColors[index % chartColors.length]} />)}</Pie><Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e3e8ef', fontSize: 10 }} /></PieChart></ResponsiveContainer>{!channelCounts.length && <p className="-mt-36 text-center text-xs text-slate-500">No complaint data yet.</p>}</Panel>
      <Panel title="Complaint outcomes" description="Current status distribution"><ResponsiveContainer width="100%" height="100%"><BarChart data={['Open', 'In progress', 'Pending customer', 'Resolved'].map((status) => ({ status, count: complaints.filter((complaint) => complaint.status === status).length }))} margin={{ top: 12, right: 8, left: -18, bottom: 0 }}><CartesianGrid vertical={false} stroke="#edf0f4" /><XAxis dataKey="status" axisLine={false} tickLine={false} tick={{ fill: '#7d8796', fontSize: 9 }} /><YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: '#7d8796', fontSize: 10 }} /><Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e3e8ef', fontSize: 10 }} /><Bar dataKey="count" name="Complaints" fill="#4675d1" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></Panel>
    </div>
    <p className="text-[10px] text-slate-400">Resolved counts are attributed to the stored resolution timestamp. All charts update immediately after a complaint status change.</p>
  </div>
}
