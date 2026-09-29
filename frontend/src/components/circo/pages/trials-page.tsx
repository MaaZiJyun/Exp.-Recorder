"use client";

import type { RecorderContext } from "@/app/use-recorder";
import { PageHeader } from "@/components/circo/page-elements";
import { ExperimentPicker } from "@/components/circo/recorder/experiment-picker";
import { Notice } from "@/components/circo/recorder/notice";
import { TrialsPanel } from "@/components/circo/recorder/trials-panel";
import { Card } from "@/components/circo/primitives";

export function TrialsPage({ ctx }: { ctx: RecorderContext }) {
  const { notice, setNotice } = ctx;
  return <div className="grid min-w-0 gap-6">
    <PageHeader eyebrow="Filters" title="Trials" subtitle="Review, annotate, and export trials from a selected experiment." />
    <Notice notice={notice} onClose={() => setNotice(null)} />
    <Card><ExperimentPicker ctx={ctx} /></Card>
    <TrialsPanel ctx={ctx} />
  </div>;
}
