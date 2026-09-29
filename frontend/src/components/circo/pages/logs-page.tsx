"use client";

import type { RecorderContext } from "@/app/use-recorder";
import { PageHeader } from "@/components/circo/page-elements";
import { Badge, Card, EmptyState } from "@/components/circo/primitives";

export function LogsPage({ ctx }: { ctx: RecorderContext }) {
  const { task, logWindowRef } = ctx;
  return <div className="grid gap-8">
    <PageHeader eyebrow="Operation" title="Logs" subtitle="View live system messages from the current experiment task." actions={<Badge tone={task.status === "COMPLETED" ? "success" : task.status === "FAILED" ? "danger" : "neutral"}>{task.status}</Badge>} />
    <Card className="p-5">
      {task.logs.length === 0 ? <EmptyState title="No logs" description="System messages will appear here after an experiment starts." /> : <div ref={logWindowRef} role="log" aria-live="polite" className="max-h-[65vh] overflow-y-auto rounded-xl bg-zinc-950 p-4 font-mono text-xs leading-7 text-zinc-200">{task.logs.map((log, index) => <div className="grid grid-cols-[6rem_1fr] gap-3" key={`${log.timestamp}-${index}`}><time className="text-zinc-500">{log.timestamp.slice(11, 19)}</time><span>{log.message}</span></div>)}</div>}
    </Card>
  </div>;
}
