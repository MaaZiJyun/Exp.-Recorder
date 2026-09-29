"use client";

import type { RecorderContext } from "@/app/use-recorder";
import { PageHeader } from "@/components/circo/page-elements";
import { ExperimentPicker } from "@/components/circo/recorder/experiment-picker";
import { ExperimentPlansPanel } from "@/components/circo/recorder/experiment-plans-panel";
import { Notice } from "@/components/circo/recorder/notice";
import { Card } from "@/components/circo/primitives";

export function PlansPage({ ctx }: { ctx: RecorderContext }) {
  const { notice, setNotice } = ctx;
  return <div className="grid min-w-0 gap-6">
    <PageHeader eyebrow="Filters" title="Plans" subtitle="Prepare stimulation plans for a selected experiment." />
    <Notice notice={notice} onClose={() => setNotice(null)} />
    <Card><ExperimentPicker ctx={ctx} /></Card>
    <ExperimentPlansPanel ctx={ctx} />
  </div>;
}
