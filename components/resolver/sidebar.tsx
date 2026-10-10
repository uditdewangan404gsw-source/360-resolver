'use client'

import {
  AlarmClock, BookOpen, ChartNoAxesCombined, CirclePlus, Copy, Inbox,
  LayoutDashboard, LogOut, Settings2, UsersRound,
} from 'lucide-react'
import { navigation, type UserRole, type ViewKey } from './types'
import { BrandLockup } from '@/components/brand-lockup'

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
      <div className="flex h-[74px] items-center border-b border-white/10 px-4">
        <BrandLockup size={40} inverse subtitle="COMPLAINT OPERATIONS" />
      </div>
      <nav aria-label="Primary navigation" className="px-3 pt-4">
        {navigation.filter((item) => role === 'Manager' || item.key !== 'team').map((item, index) => {
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
        <button onClick={onLogout} className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-[12px] text-slate-400 hover:bg-white/[0.07] hover:text-white"><LogOut className="size-4" />Sign out <span className="ml-auto text-[10px]">{role}</span></button>
      </div>
    </aside>
  )
}
