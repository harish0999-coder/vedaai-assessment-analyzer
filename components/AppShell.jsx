'use client';

import { LayoutGrid, MonitorPlay, FileText, ClipboardList, Clock, Sparkles, HelpCircle, Bell, ChevronDown, ArrowLeft } from 'lucide-react';

const NAV_ITEMS = [
  { label: 'Home', icon: LayoutGrid },
  { label: 'My Classroom', icon: MonitorPlay },
  { label: 'Assignments', icon: FileText },
  { label: 'Exams', icon: ClipboardList, active: true },
  { label: 'My Library', icon: Clock },
];

function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-ink-100 bg-white px-4 py-5 md:flex">
      <div className="flex items-center gap-2 px-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-ink text-sm font-bold text-white">V</div>
        <span className="font-display text-lg font-bold text-ink-900">VedaAI</span>
      </div>

      <button className="mt-5 flex items-center justify-center gap-2 rounded-full border-2 border-ink bg-ink-900 px-4 py-2.5 text-sm font-semibold text-white">
        <Sparkles className="h-4 w-4 text-amber" />
        AI Teacher&apos;s Toolkit
      </button>

      <nav className="mt-6 flex flex-1 flex-col gap-1">
        {NAV_ITEMS.map(({ label, icon: Icon, active }) => (
          <div
            key={label}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm ${
              active ? 'bg-ink-50 font-semibold text-ink-900' : 'text-ink-500'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </div>
        ))}
      </nav>

      <div className="flex items-center gap-3 rounded-xl bg-ink-50 px-3 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-correct/15 text-sm">🏫</div>
        <div className="leading-tight">
          <p className="text-xs font-semibold text-ink-900">Your School</p>
          <p className="text-[11px] text-ink-500">Teacher workspace</p>
        </div>
      </div>
    </aside>
  );
}

function Topbar() {
  return (
    <header className="flex items-center justify-between border-b border-ink-100 bg-white px-4 py-3 md:px-6">
      <div className="flex items-center gap-3 text-sm text-ink-500">
        <ArrowLeft className="h-4 w-4" />
        <ClipboardList className="h-4 w-4" />
        <span>Exams</span>
      </div>
      <div className="flex items-center gap-4 text-ink-500">
        <HelpCircle className="h-4.5 w-4.5" />
        <div className="relative">
          <Bell className="h-4.5 w-4.5" />
          <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-amber" />
        </div>
        <Sparkles className="h-4.5 w-4.5" />
        <div className="flex items-center gap-1.5 text-ink-900">
          <div className="h-6 w-6 rounded-full bg-ink-100" />
          <span className="hidden text-sm font-medium sm:inline">Teacher</span>
          <ChevronDown className="h-3.5 w-3.5" />
        </div>
      </div>
    </header>
  );
}

export default function AppShell({ children }) {
  return (
    <div className="flex h-screen bg-paper-dim">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
      </div>
    </div>
  );
}
