"use client";

import type { RecorderContext } from "@/app/use-recorder";
import { MagnifyingGlassIcon, PlusIcon } from "@heroicons/react/20/solid";
import { Notice } from "@/components/circo/recorder/notice";
import { PositionCardsPanel, PositionMapPanel } from "@/components/circo/recorder/positions-panel";
import { Button, Input } from "@/components/circo/primitives";

export function PositionsPage({ ctx }: { ctx: RecorderContext }) {
  const { positionQuery, setPositionQuery, newPosition, notice, setNotice } = ctx;
  return <>
    <section className="flex w-full flex-col gap-3 sm:flex-row">
      <div className="relative min-w-0 flex-1"><MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-zinc-400" /><Input type="search" value={positionQuery} onChange={(event) => setPositionQuery(event.target.value)} placeholder="Search by position code or description…" className="pl-10" /></div>
      <Button onClick={newPosition} className="shrink-0"><PlusIcon className="size-4" />New Position</Button>
    </section>
    <Notice notice={notice} onClose={() => setNotice(null)} />
    <section className="mt-6 grid gap-5 xl:grid-cols-[minmax(300px,0.9fr)_minmax(0,1.4fr)]"><aside className="min-w-0"><PositionMapPanel ctx={ctx} /></aside><section className="min-w-0"><PositionCardsPanel ctx={ctx} /></section></section>
  </>;
}
