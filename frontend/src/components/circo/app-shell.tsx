"use client";

import { useState } from "react";
import { BeakerIcon, ChevronDownIcon, CircleStackIcon } from "@heroicons/react/24/outline";

export type Workspace = "execute" | "manage";

export function AppShell({ workspace, onWorkspaceChange, manageSection, onManageSectionChange, status, children }: { workspace: Workspace; onWorkspaceChange: (workspace: Workspace) => void; manageSection?: string; onManageSectionChange?: (section: string) => void; status: React.ReactNode; children: React.ReactNode }) {
  const [resourceOpen, setResourceOpen] = useState(false);
  const navigation = [
    { id: "execute" as const, label: "信号生发", hint: "Run", icon: BeakerIcon },
    { id: "manage" as const, label: "实验管理", hint: "Manage", icon: CircleStackIcon },
  ];
  return <div className="flex min-h-dvh bg-white text-zinc-950 lg:h-dvh lg:overflow-hidden">
    <aside className="sticky top-0 z-30 flex h-dvh w-20 shrink-0 flex-col border-r border-zinc-200 bg-zinc-50 p-3 sm:w-64 sm:p-5">
      <div className="mb-10 hidden px-2 sm:block"><p className="text-2xl font-bold tracking-tight">电信号实验台</p><p className="mt-1 text-xs text-zinc-500">Local control plane</p></div>
      <div className="mb-8 grid size-11 place-items-center self-center rounded-xl bg-zinc-950 text-sm font-bold text-white sm:hidden">ER</div>
      <nav className="grid gap-1">{navigation.map((item) => { const Icon = item.icon; const active = item.id === workspace; return <div key={item.id}>
        <button key={item.id} onClick={() => onWorkspaceChange(item.id)} className={`flex min-h-12 w-full items-center rounded-xl text-sm font-medium transition-colors sm:gap-3 sm:px-3 ${active ? "bg-zinc-950 text-white" : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950"}`}><Icon className="mx-auto size-5 sm:mx-0" /><span className="hidden flex-1 text-left sm:block">{item.label}<small className={`ml-2 text-[10px] ${active ? "text-zinc-400" : "text-zinc-400"}`}>{item.hint}</small></span>{item.id === "manage" && <ChevronDownIcon className={`hidden size-4 transition-transform sm:block ${active ? "rotate-180" : ""}`} />}</button>
        {item.id === "manage" && active && <div className="ml-4 mt-1 grid gap-1 border-l border-zinc-200 pl-3">
          {[['positions','刺激点位'],['experiments','预设计划'],['trials','实验试次']].map(([id,label]) => <button key={id} type="button" onClick={() => onManageSectionChange?.(id)} className={`rounded-lg px-3 py-2 text-left text-xs font-medium ${manageSection === id ? "bg-zinc-200 text-zinc-950" : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950"}`}>{label}</button>)}
        </div>}
      </div>; })}</nav>
      <div className="mt-2">
        <button type="button" onClick={() => { setResourceOpen((open) => !open); onWorkspaceChange("manage"); onManageSectionChange?.("subjects"); }} className="flex min-h-12 w-full items-center rounded-xl text-sm font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-950 sm:gap-3 sm:px-3">
          <CircleStackIcon className="mx-auto size-5 sm:mx-0" /><span className="hidden flex-1 text-left sm:block">资源管理<small className="ml-2 text-[10px] text-zinc-400">Resources</small></span><ChevronDownIcon className={`hidden size-4 transition-transform sm:block ${resourceOpen ? "rotate-180" : ""}`} />
        </button>
        {resourceOpen && <div className="ml-4 mt-1 grid gap-1 border-l border-zinc-200 pl-3"><button type="button" onClick={() => { onWorkspaceChange("manage"); onManageSectionChange?.("subjects"); }} className={`w-full rounded-lg px-3 py-2 text-left text-xs font-medium ${manageSection === "subjects" ? "bg-zinc-200 text-zinc-950" : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950"}`}>实验对象</button><button type="button" className="w-full rounded-lg px-3 py-2 text-left text-xs font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950">工具耗材</button></div>}
      </div>
      <button type="button" onClick={() => { onWorkspaceChange("manage"); onManageSectionChange?.("statistics"); }} className={`mt-2 flex min-h-12 items-center rounded-xl text-sm font-medium transition-colors sm:gap-3 sm:px-3 ${manageSection === "statistics" ? "bg-zinc-950 text-white" : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950"}`}>
        <span className="mx-auto text-base sm:mx-0">▥</span><span className="hidden sm:block">数据统计<small className="ml-2 text-[10px] text-zinc-400">Statistics</small></span>
      </button>
      <div className="mt-auto hidden border-t border-zinc-200 pt-5 sm:block">{status}</div>
    </aside>
    <div className="min-w-0 flex-1 lg:overflow-y-auto"><main className="mx-auto max-w-7xl p-4 sm:p-7 lg:p-10">{children}</main></div>
  </div>;
}
