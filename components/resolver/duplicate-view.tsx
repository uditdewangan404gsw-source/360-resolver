'use client'

import { useMemo } from 'react'
import { AlertTriangle, CheckCheck, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { findDuplicateCandidates, type Complaint } from './types'

type Decision = 'confirmed' | 'rejected'

export function DuplicateClustersView({ complaints, decisions, onDecision, onSelectComplaint }: {
  complaints: Complaint[]
  decisions: Record<string, Decision>
  onDecision: (key: string, decision: Decision) => void
  onSelectComplaint: (id: string) => void
}) {
  const pairs = useMemo(() => {
    const discovered = findDuplicateCandidates(complaints)
    const byKey = new Map(discovered.map((candidate) => [candidate.key, candidate]))
    for (const complaint of complaints) {
      for (const linkedId of complaint.duplicateIds) {
        const other = complaints.find((candidate) => candidate.id === linkedId)
        if (!other) continue
        const [firstId, secondId] = [complaint.id, other.id].sort()
        const key = `${firstId}:${secondId}`
        if (!byKey.has(key)) {
          byKey.set(key, {
            key,
            first: firstId === complaint.id ? complaint : other,
            second: secondId === complaint.id ? complaint : other,
            reason: 'Previously recorded complaint link',
          })
        }
      }
    }
    return [...byKey.values()].filter((pair) => decisions[pair.key] !== 'rejected')
  }, [complaints, decisions])
  const confirmedCount = Object.values(decisions).filter((value) => value === 'confirmed').length
  const rejectedCount = Object.values(decisions).filter((value) => value === 'rejected').length
  const suggestedCount = pairs.filter(({ key }) => !decisions[key]).length

  return <div className="flex flex-col gap-5">
    <div><div className="flex flex-wrap items-center gap-2"><h1 className="text-[23px] font-semibold tracking-[-0.04em] text-slate-950">Duplicate clusters</h1><span className="demo-tag"><span className="size-1.5 rounded-full bg-amber-500" />HUMAN REVIEW REQUIRED</span></div><p className="mt-1 text-[12px] text-slate-500">Baseline matching highlights similar cases for an agent to review.</p></div>
    <div role="note" className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50/70 px-4 py-3"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-700" /><div><div className="text-[11px] font-semibold text-amber-950">Cases are never merged automatically</div><div className="mt-1 text-[10px] leading-relaxed text-amber-900/75">Suggestions use matching subjects or the same customer and category within 30 days. Confirming records a relationship only; complaint histories and SLAs remain separate.</div></div></div>
    <div className="grid gap-3 sm:grid-cols-3"><div className="metric-card"><div className="text-[10px] text-slate-500">Pending review</div><div className="mt-2 text-2xl font-semibold text-amber-700">{suggestedCount}</div></div><div className="metric-card"><div className="text-[10px] text-slate-500">Confirmed links</div><div className="mt-2 text-2xl font-semibold text-blue-700">{confirmedCount}</div></div><div className="metric-card"><div className="text-[10px] text-slate-500">Rejected suggestions</div><div className="mt-2 text-2xl font-semibold text-slate-900">{rejectedCount}</div></div></div>
    <div className="flex flex-col gap-3">{pairs.map(({ key, first, second, reason }) => <section key={key} className="panel-card"><div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-3"><div className="flex items-center gap-2 text-[12px] font-semibold text-slate-800"><Copy className="size-4 text-slate-500" />{decisions[key] === 'confirmed' ? 'Confirmed relationship' : 'Potential duplicate match'}</div>{decisions[key] === 'confirmed' ? <span className="status-pill status-progress">Relationship confirmed</span> : <span className="rounded bg-amber-50 px-2 py-1 text-[9px] font-semibold text-amber-800">Suggested · review required</span>}</div><div className="grid gap-3 p-5 md:grid-cols-[1fr_auto_1fr]"><button onClick={() => onSelectComplaint(first.id)} className="rounded-md border border-slate-200 p-3 text-left hover:border-blue-300"><span className="font-mono text-[9px] text-slate-400">{first.id}</span><span className="mt-1 block text-[11px] font-semibold text-slate-800">{first.subject}</span><span className="mt-1 block text-[10px] text-slate-500">{first.customerRef} · {first.category}</span></button><span className="self-center text-center text-[10px] font-medium text-slate-400">Possible match<br />{reason}</span><button onClick={() => onSelectComplaint(second.id)} className="rounded-md border border-slate-200 p-3 text-left hover:border-blue-300"><span className="font-mono text-[9px] text-slate-400">{second.id}</span><span className="mt-1 block text-[11px] font-semibold text-slate-800">{second.subject}</span><span className="mt-1 block text-[10px] text-slate-500">{second.customerRef} · {second.category}</span></button></div>{!decisions[key] && <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3"><Button variant="outline" onClick={() => onDecision(key, 'rejected')} className="h-7 border-slate-200 px-2 text-[10px]">Reject suggestion</Button><Button variant="outline" onClick={() => onDecision(key, 'confirmed')} className="h-7 border-slate-200 px-2 text-[10px]"><CheckCheck data-icon="inline-start" />Confirm relationship</Button></div>}</section>)}{pairs.length === 0 && <div className="panel-card px-5 py-12 text-center text-xs text-slate-500">No duplicate suggestions need review.</div>}</div>
  </div>
}
