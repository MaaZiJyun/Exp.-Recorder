"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";
import {
  BeakerIcon,
  BookOpenIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleStackIcon,
  ComputerDesktopIcon,
  HomeIcon,
  KeyIcon,
} from "@heroicons/react/24/outline";
import { appConfig } from "@/config/app-config";

export type PageId =
  | "homepage"
  | "guide"
  | "species"
  | "subjects"
  | "materials-tools"
  | "hardware"
  | "software"
  | "positions"
  | "channels"
  | "behaviors"
  | "experiments"
  | "plans"
  | "trials"
  | "signal-generation"
  | "live-control"
  | "logs";

type NavigationLink = [PageId, string];

const navigationGroups = [
  {
    label: "Resources",
    icon: CircleStackIcon,
    items: [
      ["species", "Species"],
      ["subjects", "Subjects"],
      ["materials-tools", "Materials / Tools"],
      ["hardware", "Hardware"],
      ["software", "Software"],
    ],
  },
  {
    label: "Method",
    icon: KeyIcon,
    items: [
      ["positions", "Positions"],
      ["channels", "Channels"],
      ["behaviors", "Behavior"],
    ],
  },
  {
    label: "Test",
    icon: BeakerIcon,
    items: [
      ["experiments", "Experiments"],
      ["plans", "Plans"],
      ["trials", "Trials"],
    ],
  },
  {
    label: "Operation",
    icon: ComputerDesktopIcon,
    items: [
      ["signal-generation", "Signal Generation"],
      ["live-control", "Live Control"],
      ["logs", "Logs"],
    ],
  },
] satisfies Array<{
  label: string;
  icon: typeof CircleStackIcon;
  items: NavigationLink[];
}>;

export function AppShell({
  activePage,
  onPageChange,
  children,
}: {
  activePage: PageId;
  onPageChange: (page: PageId) => void;
  children: ReactNode;
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (label: string) => {
    if (sidebarCollapsed) {
      setSidebarCollapsed(false);
      setExpandedGroups({ [label]: true });
      return;
    }
    setExpandedGroups((current) =>
      current[label] ? {} : { [label]: true },
    );
  };

  return <div className="flex min-h-dvh max-w-full overflow-x-hidden bg-white text-zinc-950 lg:h-dvh lg:overflow-hidden">
    <aside className={`sticky top-0 z-30 flex h-dvh shrink-0 flex-col border-r border-zinc-200 bg-zinc-50 transition-[width,padding] duration-200 ${sidebarCollapsed ? "w-20 p-3" : "w-20 p-3 sm:w-64 sm:p-5"}`}>
      <div className={`mb-6 hidden items-center sm:flex ${sidebarCollapsed ? "justify-center" : "gap-2"}`}>
        {!sidebarCollapsed ? (
          <button
            type="button"
            onClick={() => onPageChange("homepage")}
            className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 text-left"
            title="Homepage"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-zinc-200 bg-white">
              <Image src={appConfig.icon} width={24} height={24} alt="" priority />
            </span>
            <div className="min-w-0">
              <p className="truncate text-xl font-bold tracking-tight">{appConfig.name}</p>
              <p className="mt-0.5 truncate text-xs text-zinc-500">{appConfig.tagline}</p>
            </div>
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => setSidebarCollapsed((current) => !current)}
          className="grid size-9 shrink-0 place-items-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-200 hover:text-zinc-950"
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {sidebarCollapsed ? <ChevronRightIcon className="size-5" /> : <ChevronLeftIcon className="size-5" />}
        </button>
      </div>

      <button type="button" onClick={() => onPageChange("homepage")} className="mb-6 grid size-11 place-items-center self-center rounded-lg border border-zinc-200 bg-white sm:hidden" title="Homepage">
        <Image src={appConfig.icon} width={24} height={24} alt={appConfig.name} priority />
      </button>

      <nav className="grid gap-2" aria-label="Main navigation">
        <button
          type="button"
          onClick={() => onPageChange("homepage")}
          aria-current={activePage === "homepage" ? "page" : undefined}
          title="Homepage"
          className={`flex min-h-10 items-center rounded-lg px-3 text-sm font-semibold transition-colors ${sidebarCollapsed ? "justify-center" : "justify-center sm:justify-start sm:gap-3"} ${activePage === "homepage" ? "bg-zinc-950 text-white" : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950"}`}
        >
          <HomeIcon className="size-5 shrink-0" />
          {!sidebarCollapsed ? <span className="hidden sm:block">Homepage</span> : null}
        </button>
        <button
          type="button"
          onClick={() => onPageChange("guide")}
          aria-current={activePage === "guide" ? "page" : undefined}
          title="Guide"
          className={`flex min-h-10 items-center rounded-lg px-3 text-sm font-semibold transition-colors ${sidebarCollapsed ? "justify-center" : "justify-center sm:justify-start sm:gap-3"} ${activePage === "guide" ? "bg-zinc-950 text-white" : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950"}`}
        >
          <BookOpenIcon className="size-5 shrink-0" />
          {!sidebarCollapsed ? <span className="hidden sm:block">Guide</span> : null}
        </button>

        {navigationGroups.map((group) => {
          const Icon = group.icon;
          const expanded = Boolean(expandedGroups[group.label]);
          return <section key={group.label} aria-labelledby={`nav-${group.label}`}>
            <button
              type="button"
              id={`nav-${group.label}`}
              aria-expanded={expanded && !sidebarCollapsed}
              onClick={() => toggleGroup(group.label)}
              title={group.label}
              className={`flex min-h-10 w-full items-center rounded-lg text-sm font-semibold text-zinc-800 hover:bg-zinc-100 ${sidebarCollapsed ? "justify-center px-2" : "justify-center px-2 sm:justify-start sm:gap-3 sm:px-3"}`}
            >
              <Icon className="size-5 shrink-0" />
              {!sidebarCollapsed ? <span className="hidden flex-1 text-left sm:block">{group.label}</span> : null}
              {!sidebarCollapsed ? <ChevronDownIcon className={`hidden size-4 transition-transform sm:block ${expanded ? "rotate-180" : ""}`} /> : null}
            </button>
            {expanded && !sidebarCollapsed ? <div className="mt-1 grid gap-1 sm:ml-4 sm:border-l sm:border-zinc-200 sm:pl-3">
              {group.items.map(([id, label]) => <button
                  key={id}
                  type="button"
                  onClick={() => onPageChange(id)}
                  aria-current={activePage === id ? "page" : undefined}
                  title={label}
                  className={`min-h-9 rounded-lg px-2 text-center text-xs font-medium transition-colors sm:px-3 sm:text-left ${activePage === id ? "bg-zinc-950 text-white" : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950"}`}
                >
                  <span className="sm:hidden">{label.slice(0, 1)}</span>
                  <span className="hidden sm:inline">{label}</span>
                </button>)}
            </div> : null}
          </section>;
        })}
      </nav>

    </aside>

    <div className="min-w-0 max-w-full flex-1 overflow-x-hidden lg:overflow-y-auto">
      <main className={activePage === "live-control" ? "h-dvh min-w-0 max-w-full" : "mx-auto min-w-0 max-w-7xl p-4 sm:p-7 lg:p-10"}>
        {children}
      </main>
    </div>
  </div>;
}
