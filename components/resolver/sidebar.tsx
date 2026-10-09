'use client'

import {
  AlarmClock, BookOpen, ChartNoAxesCombined, CirclePlus, Copy, Inbox,
  LayoutDashboard, LifeBuoy, LogOut, Settings2, UsersRound, Landmark,
} from 'lucide-react'
import { navigation, type UserRole, type ViewKey } from './types'

const icons = { LayoutDashboard, Inbox, CirclePlus, AlarmClock, Copy, ChartNoAxesCombined, BookOpen, UsersRound, Settings2 }

export function Sidebar({ active, role, openCount, onNavigate, onLogout }: {
  active: ViewKey
  role: UserRole
  openCount: number
  onNavigate: (view: ViewKey) => void
  onLogout: () => void
}) {
  return (
    <aside className="sidebar-shell flex h-full w-[248px] shrink-0 flex-col text-white">
      <div className="flex h-[74px] items-center gap-3 border-b border-white/10 px-5">
        <div className="flex size-9 items-center justify-center rounded-lg bg-blue-500/20 text-blue-300"><Landmark className="size-[19px]" /></div>
        <div><div className="text-[15px] font-semibold tracking-tight">360° Resolver</div><div className="mt-0.5 text-[10px] font-medium tracking-[0.14em] text-slate-400">COMPLAINT OPERATIONS</div></div>
      </div>
      <nav aria-label="Primary navigation" className="px-3 pt-4">
        {navigation.map((item, index) => {
          const Icon = icons[item.icon as keyof typeof icons]
          const showSection = item.section !== navigation[index - 1]?.section
          return <div key={item.key}>
            {showSection && <div className={`px-3 text-[10px] font-semibold tracking-[0.13em] text-slate-400 ${index ? 'mb-1.5 mt-5' : 'mb-1.5'}`}>{item.section}</div>}
            <button onClick={() => onNavigate(item.key)} className={`nav-item mb-0.5 flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 ${active === item.key ? 'bg-[#203758] text-white shadow-[inset_2px_0_0_#81a9ef]' : 'text-slate-200 hover:bg-white/[0.08] hover:text-white'}`} aria-current={active === item.key ? 'page' : undefined}>
              <Icon className={`size-[17px] ${active === item.key ? 'text-blue-300' : 'text-slate-400'}`} strokeWidth={1.8} />
              <span className="flex-1">{item.label}</span>
              {item.key === 'inbox' && <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-medium text-slate-300">{openCount}</span>}
            </button>
          </div>
        })}
      </nav>
      <div className="mt-auto px-3 pb-4">
        <div className="mb-3 rounded-lg border border-white/10 bg-white/[0.04] p-3">
          <div className="flex items-center gap-2"><span className="size-1.5 rounded-full bg-emerald-400" /><span className="text-[11px] font-medium text-slate-200">Demo environment</span></div>
          <p className="mt-1.5 text-[10px] leading-relaxed text-slate-400">Channels, classification, and delivery are simulated.</p>
        </div>
        <button onClick={() => onNavigate('knowledge')} className="mb-1 flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-[12px] text-slate-400 hover:bg-white/[0.07] hover:text-white"><LifeBuoy className="size-4" />Help center</button>
        <button onClick={onLogout} className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-[12px] text-slate-400 hover:bg-white/[0.07] hover:text-white"><LogOut className="size-4" />Sign out <span className="ml-auto text-[10px]">{role}</span></button>
      </div>
    </aside>
  )
}
