"use client";

import type { RecorderContext } from "@/app/use-recorder";
import { ExperimentIndex } from "@/components/circo/recorder/experiment-index";
import { Notice } from "@/components/circo/recorder/notice";
import { TrialsPanel } from "@/components/circo/recorder/trials-panel";

export function TrialsPage({ ctx }: { ctx: RecorderContext }) {
  const { notice, setNotice } = ctx;
  return <>
    <Notice notice={notice} onClose={() => setNotice(null)} />
    <section className="dashboard-grid manage-layout"><aside className="left-column"><ExperimentIndex ctx={ctx} /></aside><section className="right-column"><TrialsPanel ctx={ctx} /></section></section>
  </>;
}
