"use client";

import type { RecorderContext } from "@/app/use-recorder";
import { MagnifyingGlassIcon, PlusIcon } from "@heroicons/react/20/solid";
import { Notice } from "@/components/circo/recorder/notice";
import { SpeciesPanel, SubjectRecordsPanel } from "@/components/circo/recorder/subjects-panel";
import { Button, Input } from "@/components/circo/ui";

export function ObjectsPage({ ctx }: { ctx: RecorderContext }) {
  const { subjectQuery, setSubjectQuery, newSubject, notice, setNotice } = ctx;
  return <>
    <section className="flex w-full flex-col gap-3 sm:flex-row">
      <div className="relative min-w-0 flex-1"><MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-zinc-400" /><Input type="search" value={subjectQuery} onChange={(event) => setSubjectQuery(event.target.value)} placeholder="搜索 Subject ID 或备注…" className="pl-10" /></div>
      <Button onClick={newSubject} className="shrink-0"><PlusIcon className="size-4" />新建 Subject</Button>
    </section>
    <Notice notice={notice} onClose={() => setNotice(null)} />
    <section className="dashboard-grid manage-layout"><aside className="left-column"><SpeciesPanel ctx={ctx} /></aside><section className="right-column"><SubjectRecordsPanel ctx={ctx} /></section></section>
  </>;
}
