import { PageHeader } from "@/components/circo/page-elements";
import { EmptyState } from "@/components/circo/primitives";

export function MaterialsToolsPage() {
  return <div className="grid gap-8">
    <PageHeader eyebrow="Resources" title="Materials / Tools" subtitle="Manage materials, consumables, and tools used in experiments." />
    <EmptyState title="No materials or tools" description="This page is ready for material inventory and tool management features." />
  </div>;
}
