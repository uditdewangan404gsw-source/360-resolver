'use client'

import { useMemo, useState } from 'react'
import { ArrowDownWideNarrow, ChevronDown, Download, Filter, Search, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatSla, isAtRisk, type Complaint, type ComplaintStatus, type Severity } from './types'

const severityClass: Record<Severity, string> = { Critical: 'severity-critical', High: 'severity-high', Medium: 'severity-medium', Low: 'severity-low' }
const statusClass: Record<ComplaintStatus, string> = { Open: 'status-open', 'In progress': 'status-progress', 'Pending customer': 'status-pending', Resolved: 'status-resolved' }
const agents = ['Marcus Chen', 'Amina Yusuf', 'Daniel Brooks', 'Sofia Martinez', 'Unassigned']

export function InboxView({ complaints, initialFilter, searchTerm, onSelectComplaint, onNavigate }: { complaints: Complaint[]; initialFilter?: string; searchTerm: string; onSelectComplaint: (id: string) => void; onNavigate: () => void }) {
  const [query, setQuery] = useState(searchTerm)
  const [severity, setSeverity] = useState(initialFilter === 'high' ? 'High' : 'All severity')
  const [status, setStatus] = useState('All status')
  const [openOnly, setOpenOnly] = useState(initialFilter === 'open')
  const [riskOnly, setRiskOnly] = useState(initialFilter === 'risk')
  const [channel, setChannel] = useState('All channels')
  const [sort, setSort] = useState<'newest' | 'sla'>('newest')
  const results = useMemo(() => complaints.filter((item) => {
    const haystack = `${item.id} ${item.subject} ${item.customerRef} ${item.category} ${item.assignedTo}`.toLowerCase()
    return (!query || haystack.includes(query.toLowerCase())) && (severity === 'All severity' || item.severity === severity || (severity === 'High' && item.severity === 'Critical')) && (status === 'All status' || item.status === status) && (!openOnly || item.status !== 'Resolved') && (!riskOnly || isAtRisk(item)) && (channel === 'All channels' || item.channel === channel)
  }).sort((a, b) => sort === 'sla' ? a.minutesToSla - b.minutesToSla : b.id.localeCompare(a.id)), [complaints, query, severity, status, channel, sort])
  return <div className="flex flex-col gap-5">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><div className="flex items-center gap-2"><h1 className="text-[23px] font-semibold tracking-[-0.04em] text-slate-950">Complaint inbox</h1><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">{results.length} shown</span></div><p className="mt-1 text-[12px] text-slate-500">Review, prioritize, and assign customer complaints.</p></div><Button onClick={onNavigate} className="h-9 rounded-md bg-[#2459c5] px-3.5 text-[12px] hover:bg-[#1d4ca8]">+ New complaint</Button></div>
    <div className="rounded-lg border border-slate-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,.025)]">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
        <label className="relative min-w-[200px] flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><input aria-label="Search complaints" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search ID, subject, customer..." className="h-9 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-[11px] outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></label>
        <select value={severity} onChange={(e) => setSeverity(e.target.value)} className="filter-select" aria-label="Filter severity"><option>All severity</option><option>Critical</option><option>High</option><option>Medium</option><option>Low</option></select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="filter-select" aria-label="Filter status"><option>All status</option><option>Open</option><option>In progress</option><option>Pending customer</option><option>Resolved</option></select>
        <select value={channel} onChange={(e) => setChannel(e.target.value)} className="filter-select hidden sm:block" aria-label="Filter channel"><option>All channels</option><option>Mobile app</option><option>Phone</option><option>Web form</option><option>Branch</option><option>Email</option><option>Social</option></select>
        <Button variant="outline" onClick={() => setSort(sort === 'newest' ? 'sla' : 'newest')} className="h-9 gap-1.5 rounded-md border-slate-200 px-3 text-[11px]"><ArrowDownWideNarrow className="size-3.5" />{sort === 'newest' ? 'Newest' : 'SLA first'}</Button>
        {(openOnly || riskOnly || query || severity !== 'All severity' || status !== 'All status' || channel !== 'All channels') && <button onClick={() => { setQuery(''); setSeverity('All severity'); setStatus('All status'); setChannel('All channels'); setOpenOnly(false); setRiskOnly(false) }} className="h-9 px-1 text-[10px] font-medium text-blue-700 hover:text-blue-900">Clear filters</button>}
      </div>
      <div className="overflow-x-auto"><table className="data-table min-w-[1080px]"><thead><tr><th><input type="checkbox" aria-label="Select all visible complaints" className="accent-blue-600" /></th><th>Complaint</th><th>Customer ref.</th><th>Channel</th><th>Category</th><th>Severity</th><th>Sentiment</th><th>Assigned to</th><th>Status</th><th>SLA</th></tr></thead><tbody>{results.map((item) => <tr key={item.id} className="group"><td><input type="checkbox" aria-label={`Select ${item.id}`} className="accent-blue-600" /></td><td><button onClick={() => onSelectComplaint(item.id)} className="text-left"><div className="max-w-[215px] truncate font-medium text-slate-800 group-hover:text-blue-700">{item.subject}</div><div className="mt-1 text-[10px] text-slate-400">{item.id} · {item.received}</div></button></td><td className="font-mono text-[10px] text-slate-600">{item.customerRef}</td><td><span className="channel-label"><span className="channel-mark">{item.channel === 'Mobile app' ? 'M' : item.channel.charAt(0)}</span>{item.channel}</span></td><td>{item.category}</td><td><span className={`severity-badge ${severityClass[item.severity]}`}>{item.severity}</span></td><td><span className={`sentiment-text ${item.sentiment === 'Frustrated' ? 'text-rose-700' : item.sentiment === 'Negative' ? 'text-orange-700' : 'text-slate-500'}`}>{item.sentiment}</span></td><td><div className="flex items-center gap-2"><span className={`mini-avatar ${agents.indexOf(item.assignedTo) % 2 ? 'bg-violet-100 text-violet-700' : 'bg-blue-100 text-blue-700'}`}>{item.assignedTo === 'Unassigned' ? '—' : item.assignedTo.split(' ').map((p) => p[0]).join('')}</span><span className={item.assignedTo === 'Unassigned' ? 'text-amber-700' : 'text-slate-600'}>{item.assignedTo}</span></div></td><td><span className={`status-pill ${statusClass[item.status]}`}>{item.status}</span></td><td><span className={`font-medium ${item.minutesToSla <= 60 ? 'text-rose-600' : item.minutesToSla <= 120 ? 'text-amber-700' : 'text-slate-600'}`}>{formatSla(item.minutesToSla)}</span></td></tr>)}</tbody></table>
        {results.length === 0 && <div className="px-6 py-16 text-center"><div className="mx-auto mb-2 flex size-9 items-center justify-center rounded-full bg-slate-100"><Filter className="size-4 text-slate-500" /></div><div className="text-sm font-medium text-slate-800">No complaints match your filters</div><div className="mt-1 text-xs text-slate-500">Try changing your search or filter criteria.</div></div>}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-3 text-[10px] text-slate-500"><span>Showing {results.length} of {complaints.length} demo complaints <span className="mx-1">·</span> No live banking data</span><div className="flex items-center gap-3"><button className="inline-flex items-center gap-1 hover:text-slate-800"><Download className="size-3" />Export</button><span>Page 1 of 1</span><button aria-label="Next page" className="rounded border border-slate-200 px-2 py-1 text-slate-400"><ChevronDown className="size-3 -rotate-90" /></button></div></div>
    </div>
    <div className="flex items-center gap-2 text-[10px] text-slate-400"><SlidersHorizontal className="size-3.5" />Filters update this demo list instantly. Bulk actions are not connected to banking systems.</div>
  </div>
}
