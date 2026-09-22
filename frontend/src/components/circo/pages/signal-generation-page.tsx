"use client";

import type { RecorderContext } from "@/app/use-recorder";
import { ExecuteView } from "@/components/circo/recorder/execute-view";

export function SignalGenerationPage({ ctx }: { ctx: RecorderContext }) {
  return <ExecuteView ctx={ctx} />;
}
