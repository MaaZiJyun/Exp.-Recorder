"use client";

import type { RecorderContext } from "@/app/use-recorder";
import { MagnifyingGlassIcon, PlusIcon } from "@heroicons/react/20/solid";
import { ExperimentIndex } from "@/components/circo/recorder/experiment-index";
import { ExperimentPlansPanel } from "@/components/circo/recorder/experiment-plans-panel";
import { Notice } from "@/components/circo/recorder/notice";
import { Button, Input } from "@/components/circo/primitives";

export function PlansPage({ ctx }: { ctx: RecorderContext }) {
  const { experimentQuery, setExperimentQuery, newExperiment, notice, setNotice } = ctx;
  return <>
    <section className="flex w-full flex-col gap-3 sm:flex-row">
      <div className="relative min-w-0 flex-1"><MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-zinc-400" /><Input type="search" value={experimentQuery} onChange={(event) => setExperimentQuery(event.target.value)} placeholder="Search by experiment title, description, or ID…" className="pl-10" /></div>
      <Button onClick={newExperiment} className="shrink-0"><PlusIcon className="size-4" />New Experiment</Button>
    </section>
    <Notice notice={notice} onClose={() => setNotice(null)} />
    <section className="mt-6 grid gap-5 xl:grid-cols-[minmax(280px,0.75fr)_minmax(0,1.5fr)]"><aside className="min-w-0"><ExperimentIndex ctx={ctx} /></aside><section className="min-w-0"><ExperimentPlansPanel ctx={ctx} /></section></section>
  </>;
}
