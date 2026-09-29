"use client";

import type { RecorderContext } from "@/app/use-recorder";
import { PageHeader } from "@/components/circo/page-elements";
import { Notice } from "@/components/circo/recorder/notice";
import { SubjectRecordsPanel } from "@/components/circo/recorder/subjects-panel";

export function SubjectsPage({ ctx }: { ctx: RecorderContext }) {
  const { notice, setNotice } = ctx;

  return <div className="grid gap-6">
    <PageHeader
      eyebrow="Resources"
      title="Subjects"
      subtitle="Manage individual experimental subjects and their current status."
    />
    <Notice notice={notice} onClose={() => setNotice(null)} />
    <SubjectRecordsPanel ctx={ctx} />
  </div>;
}
