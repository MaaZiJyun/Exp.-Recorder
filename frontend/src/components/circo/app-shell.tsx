"use client";

import { BeakerIcon, CircleStackIcon } from "@heroicons/react/24/outline";

export type Workspace = "execute" | "manage";

export function AppShell({ workspace, onWorkspaceChange, status, children }: { workspace: Workspace; onWorkspaceChange: (workspace: Workspace) => void; status: React.ReactNode; children: React.ReactNode }) {
  const navigation = [
    { id: "execute" as const, label: "执行界面", hint: "Run", icon: BeakerIcon },
    { id: "manage" as const, label: "管理界面", hint: "Manage", icon: CircleStackIcon },
  ];
  return <div className="flex min-h-dvh bg-white text-zinc-950 lg:h-dvh lg:overflow-hidden">
    <aside className="sticky top-0 z-30 flex h-dvh w-20 shrink-0 flex-col border-r border-zinc-200 bg-zinc-50 p-3 sm:w-64 sm:p-5">
      <div className="mb-10 hidden px-2 sm:block"><p className="text-2xl font-bold tracking-tight">Exp. Recorder</p><p className="mt-1 text-xs text-zinc-500">Local control plane</p></div>
      <div className="mb-8 grid size-11 place-items-center self-center rounded-xl bg-zinc-950 text-sm font-bold text-white sm:hidden">ER</div>
      <nav className="grid gap-1">{navigation.map((item) => { const Icon = item.icon; const active = item.id === workspace; return <button key={item.id} onClick={() => onWorkspaceChange(item.id)} className={`flex min-h-12 items-center rounded-xl text-sm font-medium transition-colors sm:gap-3 sm:px-3 ${active ? "bg-zinc-950 text-white" : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950"}`}><Icon className="mx-auto size-5 sm:mx-0" /><span className="hidden sm:block">{item.label}<small className={`ml-2 text-[10px] ${active ? "text-zinc-400" : "text-zinc-400"}`}>{item.hint}</small></span></button>; })}</nav>
      <div className="mt-auto hidden border-t border-zinc-200 pt-5 sm:block">{status}</div>
    </aside>
    <div className="min-w-0 flex-1 lg:overflow-y-auto"><main className="mx-auto max-w-7xl p-4 sm:p-7 lg:p-10">{children}</main></div>
  </div>;
}
