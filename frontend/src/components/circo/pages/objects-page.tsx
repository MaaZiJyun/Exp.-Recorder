"use client";

import type { RecorderContext } from "@/app/use-recorder";
import { MagnifyingGlassIcon, PlusIcon } from "@heroicons/react/20/solid";
import { Notice } from "@/components/circo/recorder/notice";
import { SpeciesPanel, SubjectRecordsPanel } from "@/components/circo/recorder/subjects-panel";
import { Button, Input } from "@/components/circo/primitives";

export function ObjectsPage({ ctx }: { ctx: RecorderContext }) {
  const { subjectQuery, setSubjectQuery, newSubject, notice, setNotice } = ctx;
  return <>
    <section className="flex w-full flex-col gap-3 sm:flex-row">
      <div className="relative min-w-0 flex-1"><MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-zinc-400" /><Input type="search" value={subjectQuery} onChange={(event) => setSubjectQuery(event.target.value)} placeholder="Search by Subject ID or notes…" className="pl-10" /></div>
      <Button onClick={newSubject} className="shrink-0"><PlusIcon className="size-4" />New Subject</Button>
    </section>
    <Notice notice={notice} onClose={() => setNotice(null)} />
    <section className="mt-6 grid gap-5 xl:grid-cols-[minmax(280px,0.75fr)_minmax(0,1.5fr)]"><aside className="min-w-0"><SpeciesPanel ctx={ctx} /></aside><section className="min-w-0"><SubjectRecordsPanel ctx={ctx} /></section></section>
  </>;
}
