'use client'

import { useState } from 'react'
import { AlarmClock, Check, Clock3, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatSla, getSlaState, isAtRisk, isSlaBreached, type Complaint, type ComplaintStatus, type SlaRules, type UserRole } from './types'

const statusStyles: Record<ComplaintStatus, string> = {
  Open: 'status-open',
  'In progress': 'status-progress',
  'Pending customer': 'status-pending',
  Resolved: 'status-resolved',
}

export function SlaEscalationsView({ complaints, rules, role, onSave, onSelectComplaint }: {
  complaints: Complaint[]
  rules: SlaRules
  role: UserRole
  onSave: (rules: SlaRules) => Promise<SlaRules>
  onSelectComplaint: (id: string) => void
}) {
  const [filter, setFilter] = useState('At risk')
  const [standardHours, setStandardHours] = useState(String(rules.standardFirstResponseHours))
  const [criticalHours, setCriticalHours] = useState(String(rules.criticalResponseHours))
  const [elapsedPercent, setElapsedPercent] = useState(String(rules.escalationElapsedPercent))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const atRisk = complaints.filter(isAtRisk).length
  const breached = complaints.filter(isSlaBreached).length
  const onTrack = complaints.filter((complaint) => getSlaState(complaint) === 'on-track').length
  const resolved = complaints.filter((complaint) => complaint.resolvedAt)
  const onTimeResolved = resolved.filter((complaint) => new Date(complaint.resolvedAt as string) <= new Date(complaint.slaDueAt)).length
  const completionRate = resolved.length ? Math.round((onTimeResolved / resolved.length) * 100) : null
  const filtered = complaints.filter((item) => {
    if (filter === 'All cases') return true
    if (filter === 'At risk') return isAtRisk(item)
    if (filter === 'Breached') return isSlaBreached(item)
    return item.status === filter
  }).sort((a, b) => a.minutesToSla - b.minutesToSla)

  const saveRules = async () => {
    setSaving(true)
    setSaved(false)
    setError('')
    try {
      const updated = await onSave({
        standardFirstResponseHours: Number(standardHours),
        criticalResponseHours: Number(criticalHours),
        escalationElapsedPercent: Number(elapsedPercent),
      })
      setStandardHours(String(updated.standardFirstResponseHours))
      setCriticalHours(String(updated.criticalResponseHours))
      setElapsedPercent(String(updated.escalationElapsedPercent))
      setSaved(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'SLA rules could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  return <div className="flex flex-col gap-5">
    <div><div className="flex flex-wrap items-center gap-2"><h1 className="text-[23px] font-semibold tracking-[-0.04em] text-slate-950">SLA &amp; escalations</h1><span className="demo-tag"><span className="size-1.5 rounded-full bg-emerald-500" />WORKSPACE RULES</span></div><p className="mt-1 text-[12px] text-slate-500">Track response deadlines and configure escalation thresholds for new complaints.</p></div>
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="metric-card"><div className="flex items-center gap-2 text-[10px] font-medium text-slate-500"><Clock3 className="size-3.5" />On track</div><div className="mt-2 text-2xl font-semibold text-emerald-700">{onTrack}</div><div className="mt-1 text-[10px] text-slate-400">Active complaints within target</div></div>
      <div className="metric-card"><div className="flex items-center gap-2 text-[10px] font-medium text-slate-500"><AlarmClock className="size-3.5" />At risk</div><div className="mt-2 text-2xl font-semibold text-amber-700">{atRisk}</div><div className="mt-1 text-[10px] text-slate-400">Past the configured escalation point</div></div>
      <div className="metric-card"><div className="flex items-center gap-2 text-[10px] font-medium text-slate-500"><ShieldAlert className="size-3.5" />Breached</div><div className="mt-2 text-2xl font-semibold text-rose-700">{breached}</div><div className="mt-1 text-[10px] text-slate-400">Active complaints past their due time</div></div>
    </div>
    <section className="panel-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4"><div><h2 className="text-[13px] font-semibold text-slate-800">SLA queue</h2><p className="mt-1 text-[10px] text-slate-500">Deadlines are calculated from stored received and due timestamps.</p></div><select value={filter} onChange={(event) => setFilter(event.target.value)} className="filter-select" aria-label="Filter SLA queue"><option>At risk</option><option>Breached</option><option>All cases</option><option>Open</option><option>In progress</option><option>Pending customer</option><option>Resolved</option></select></div>
      <div className="overflow-x-auto"><table className="data-table min-w-[760px]"><thead><tr><th>Complaint</th><th>Severity</th><th>Assigned agent</th><th>Status</th><th>SLA state</th><th>Time remaining</th><th>Action</th></tr></thead><tbody>{filtered.map((item) => {
        const slaState = getSlaState(item)
        const stateClass = slaState === 'breached' ? 'text-rose-700' : slaState === 'at-risk' ? 'text-amber-700' : slaState === 'resolved' ? 'text-emerald-700' : 'text-emerald-700'
        return <tr key={item.id}><td><button className="text-left font-medium text-slate-800 hover:text-blue-700" onClick={() => onSelectComplaint(item.id)}>{item.subject}<span className="mt-1 block font-mono text-[9px] text-slate-400">{item.id}</span></button></td><td><span className={`severity-badge severity-${item.severity.toLowerCase()}`}>{item.severity}</span></td><td>{item.assignedTo}</td><td><span className={`status-pill ${statusStyles[item.status]}`}>{item.status}</span></td><td className={`font-medium capitalize ${stateClass}`}>{slaState.replace('-', ' ')}</td><td className={`font-semibold ${stateClass}`}>{item.status === 'Resolved' ? 'Complete' : formatSla(item.minutesToSla)}</td><td><Button onClick={() => onSelectComplaint(item.id)} variant="outline" className="h-7 border-slate-200 px-2 text-[9px]">Review</Button></td></tr>
      })}</tbody></table>{filtered.length === 0 && <div className="px-5 py-10 text-center text-xs text-slate-500">No complaints match this SLA filter.</div>}</div>
    </section>
    <section className="panel-card">
      <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4"><div className="flex items-start gap-3"><div className="flex size-9 items-center justify-center rounded-lg bg-blue-50 text-blue-700"><AlarmClock className="size-4" /></div><div><h2 className="text-[13px] font-semibold text-slate-800">Workspace SLA rules</h2><p className="mt-1 text-[10px] text-slate-500">Saved settings apply to new complaints. Existing complaints retain their stored due time.</p></div></div><Button onClick={saveRules} disabled={saving || role !== 'Manager'} variant="outline" className="h-8 border-slate-200 px-3 text-[10px]">{saved ? <><Check data-icon="inline-start" />Saved to workspace</> : saving ? 'Saving…' : role === 'Manager' ? 'Save SLA rules' : 'Manager access required'}</Button></div>
      {error && <p role="alert" className="border-t border-rose-200 bg-rose-50 px-5 py-2 text-[10px] text-rose-800">{error}</p>}
      <div className="grid gap-3 border-t border-slate-100 p-5 sm:grid-cols-3"><label className="field-block"><span>Standard first response</span><div className="field-suffix"><input type="number" min="1" max="72" step="1" value={standardHours} disabled={role !== 'Manager'} onChange={(event) => setStandardHours(event.target.value)} /><span>hours</span></div></label><label className="field-block"><span>Critical response target</span><div className="field-suffix"><input type="number" min="1" max="24" step="1" value={criticalHours} disabled={role !== 'Manager'} onChange={(event) => setCriticalHours(event.target.value)} /><span>hours</span></div></label><label className="field-block"><span>Escalate after</span><div className="field-suffix"><input type="number" min="1" max="99" step="1" value={elapsedPercent} disabled={role !== 'Manager'} onChange={(event) => setElapsedPercent(event.target.value)} /><span>% elapsed</span></div></label></div>
      <div className="border-t border-slate-100 px-5 py-3 text-[10px] text-slate-500">On-time resolution: {completionRate === null ? 'No resolved complaints yet' : `${completionRate}% (${onTimeResolved} of ${resolved.length})`} · Only managers can change workspace-wide policy.</div>
    </section>
  </div>
}
