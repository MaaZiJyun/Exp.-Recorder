"use client";

import type { RecorderContext } from "@/app/use-recorder";
import { MagnifyingGlassIcon, PlusIcon } from "@heroicons/react/20/solid";
import { Notice } from "@/components/circo/recorder/notice";
import { PositionCardsPanel, PositionMapPanel } from "@/components/circo/recorder/positions-panel";
import { Button, Input } from "@/components/circo/ui";

export function PositionsPage({ ctx }: { ctx: RecorderContext }) {
  const { positionQuery, setPositionQuery, newPosition, notice, setNotice } = ctx;
  return <>
    <section className="flex w-full flex-col gap-3 sm:flex-row">
      <div className="relative min-w-0 flex-1"><MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-zinc-400" /><Input type="search" value={positionQuery} onChange={(event) => setPositionQuery(event.target.value)} placeholder="搜索 Position code 或描述…" className="pl-10" /></div>
      <Button onClick={newPosition} className="shrink-0"><PlusIcon className="size-4" />新建 Position</Button>
    </section>
    <Notice notice={notice} onClose={() => setNotice(null)} />
    <section className="dashboard-grid manage-layout"><aside className="left-column"><PositionMapPanel ctx={ctx} /></aside><section className="right-column"><PositionCardsPanel ctx={ctx} /></section></section>
  </>;
}
