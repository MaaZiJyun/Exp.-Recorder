"use client";

import type { RecorderContext } from "@/app/use-recorder";
import { PageHeader } from "@/components/circo/page-elements";
import { Notice } from "@/components/circo/recorder/notice";
import { SpeciesPanel } from "@/components/circo/recorder/subjects-panel";

export function SpeciesPage({ ctx }: { ctx: RecorderContext }) {
  const { notice, setNotice } = ctx;

  return <div className="grid gap-6">
    <PageHeader
      eyebrow="Resources"
      title="Species"
      subtitle="Manage species definitions, biological cycles, and reference images."
    />
    <Notice notice={notice} onClose={() => setNotice(null)} />
    <SpeciesPanel ctx={ctx} />
  </div>;
}
