"use client";

import type { RecorderContext } from "@/app/use-recorder";
import { ExperimentIndex } from "@/components/circo/recorder/experiment-index";
import { Notice } from "@/components/circo/recorder/notice";
import { TrialsPanel } from "@/components/circo/recorder/trials-panel";

export function TrialsPage({ ctx }: { ctx: RecorderContext }) {
  const { notice, setNotice } = ctx;
  return <>
    <Notice notice={notice} onClose={() => setNotice(null)} />
    <section className="mt-6 grid gap-5 xl:grid-cols-[minmax(280px,0.7fr)_minmax(0,1.6fr)]"><aside className="min-w-0"><ExperimentIndex ctx={ctx} /></aside><section className="min-w-0"><TrialsPanel ctx={ctx} /></section></section>
  </>;
}
