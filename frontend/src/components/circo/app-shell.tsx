"use client";

import { BeakerIcon, CircleStackIcon, FunnelIcon } from "@heroicons/react/24/outline";

export type PageId =
  | "objects"
  | "materials-tools"
  | "hardware"
  | "software"
  | "positions"
  | "plans"
  | "trials"
  | "signal-generation"
  | "live-control"
  | "logs";

const navigationGroups = [
  {
    label: "资源",
    icon: CircleStackIcon,
    items: [
      ["objects", "对象"],
      ["materials-tools", "材料/工具"],
      ["hardware", "硬件"],
      ["software", "软件"],
    ],
  },
  {
    label: "筛选",
    icon: FunnelIcon,
    items: [
      ["positions", "点位"],
      ["plans", "计划"],
      ["trials", "试次"],
      ["signal-generation", "信号生发"],
    ],
  },
  {
    label: "实测",
    icon: BeakerIcon,
    items: [
      ["live-control", "实时控制"],
      ["logs", "日志"],
    ],
  },
] satisfies Array<{ label: string; icon: typeof CircleStackIcon; items: Array<[PageId, string]> }>;

export function AppShell({ activePage, onPageChange, status, children }: { activePage: PageId; onPageChange: (page: PageId) => void; status: React.ReactNode; children: React.ReactNode }) {
  return <div className="flex min-h-dvh bg-white text-zinc-950 lg:h-dvh lg:overflow-hidden">
    <aside className="sticky top-0 z-30 flex h-dvh w-20 shrink-0 flex-col border-r border-zinc-200 bg-zinc-50 p-3 sm:w-64 sm:p-5">
      <div className="mb-8 hidden px-2 sm:block"><p className="text-2xl font-bold tracking-tight">电信号实验台</p><p className="mt-1 text-xs text-zinc-500">Local control plane</p></div>
      <div className="mb-6 grid size-11 place-items-center self-center rounded-xl bg-zinc-950 text-sm font-bold text-white sm:hidden">ER</div>
      <nav className="grid gap-5" aria-label="主导航">
        {navigationGroups.map((group) => {
          const Icon = group.icon;
          return <section key={group.label} aria-labelledby={`nav-${group.label}`}>
            <div id={`nav-${group.label}`} className="flex min-h-10 items-center text-sm font-semibold text-zinc-800 sm:gap-3 sm:px-3">
              <Icon className="mx-auto size-5 sm:mx-0" />
              <span className="hidden sm:block">{group.label}</span>
            </div>
            <div className="mt-1 grid gap-1 sm:ml-4 sm:border-l sm:border-zinc-200 sm:pl-3">
              {group.items.map(([id, label]) => <button key={id} type="button" onClick={() => onPageChange(id)} aria-current={activePage === id ? "page" : undefined} title={label} className={`min-h-9 rounded-lg px-2 text-center text-xs font-medium transition-colors sm:px-3 sm:text-left ${activePage === id ? "bg-zinc-950 text-white" : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950"}`}>
                <span className="sm:hidden">{label.slice(0, 1)}</span><span className="hidden sm:inline">{label}</span>
              </button>)}
            </div>
          </section>;
        })}
      </nav>
      <div className="mt-auto hidden border-t border-zinc-200 pt-5 sm:block">{status}</div>
    </aside>
    <div className="min-w-0 flex-1 lg:overflow-y-auto"><main className="mx-auto max-w-7xl p-4 sm:p-7 lg:p-10">{children}</main></div>
  </div>;
}
