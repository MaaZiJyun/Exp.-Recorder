"use client";

import { AppShell } from "@/components/circo/app-shell";
import { Badge } from "@/components/circo/ui";
import { ExecuteView } from "@/components/circo/recorder/execute-view";
import { ManageView } from "@/components/circo/recorder/manage-view";
import { useRecorder } from "./use-recorder";

export default function Home() {
  const ctx = useRecorder();
  const { view, manageTab, devices, ready, changeSection, changeWorkspace } =
    ctx;

  return (
    <AppShell
      workspace={view}
      manageSection={manageTab}
      onManageSectionChange={changeSection}
      onWorkspaceChange={changeWorkspace}
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
      {view === "execute" ? (
        <ExecuteView ctx={ctx} />
      ) : (
        <ManageView ctx={ctx} />
      )}
    </AppShell>
  );
}
