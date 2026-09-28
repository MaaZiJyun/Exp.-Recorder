"use client";

import { useState } from "react";
import { AppShell, type PageId } from "@/components/circo/app-shell";
import { Badge } from "@/components/circo/ui";
import { HardwarePage } from "@/components/circo/pages/hardware-page";
import { LiveControlPage } from "@/components/circo/pages/live-control-page";
import { LogsPage } from "@/components/circo/pages/logs-page";
import { MaterialsToolsPage } from "@/components/circo/pages/materials-tools-page";
import { ObjectsPage } from "@/components/circo/pages/objects-page";
import { PlansPage } from "@/components/circo/pages/plans-page";
import { PositionsPage } from "@/components/circo/pages/positions-page";
import { SignalGenerationPage } from "@/components/circo/pages/signal-generation-page";
import { SoftwarePage } from "@/components/circo/pages/software-page";
import { TrialsPage } from "@/components/circo/pages/trials-page";
import { useRecorder } from "./use-recorder";
import type { Board } from "./types";

export default function Home() {
  const ctx = useRecorder();
  const { devices, ready, changeSection, changeWorkspace } = ctx;
  const [activePage, setActivePage] = useState<PageId>("signal-generation");
  const [controlBoard, setControlBoard] = useState<Board | null>(null);

  const changePage = (page: PageId) => {
    setActivePage(page);
    const manageSections: Partial<Record<PageId, string>> = {
      objects: "subjects",
      positions: "positions",
      plans: "experiments",
      trials: "trials",
    };
    const section = manageSections[page];
    if (section) changeSection(section);
    else changeWorkspace("execute");
  };

  const content = {
    objects: <ObjectsPage ctx={ctx} />,
    "materials-tools": <MaterialsToolsPage />,
    hardware: <HardwarePage onOpenConsole={(board) => { setControlBoard(board); changePage("live-control"); }} />,
    software: <SoftwarePage />,
    positions: <PositionsPage ctx={ctx} />,
    plans: <PlansPage ctx={ctx} />,
    trials: <TrialsPage ctx={ctx} />,
    "signal-generation": <SignalGenerationPage ctx={ctx} />,
    "live-control": <LiveControlPage board={controlBoard} />,
    logs: <LogsPage ctx={ctx} />,
  } satisfies Record<PageId, React.ReactNode>;

  return (
    <AppShell
      activePage={activePage}
      onPageChange={changePage}
      status={
        <div className="grid gap-2">
          <Badge tone={ready ? "success" : "neutral"}>
            {devices
              ? ready
                ? "SYSTEM READY"
                : "HARDWARE OFFLINE"
              : "API OFFLINE"}
          </Badge>
          <p className="text-xs leading-5 text-zinc-500">
            SQLite · SCPI · USB Serial
          </p>
        </div>
      }
    >
      {content[activePage]}
    </AppShell>
  );
}
