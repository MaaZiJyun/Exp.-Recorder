import { PageHeader } from "@/components/circo/page-elements";
import { EmptyState } from "@/components/circo/ui";

export function MaterialsToolsPage() {
  return <div className="grid gap-8">
    <PageHeader eyebrow="资源" title="材料/工具" subtitle="管理实验所需的材料、耗材与工具。" />
    <EmptyState title="暂无材料或工具" description="该页面已独立建立，可在这里继续接入材料库存与工具管理功能。" />
  </div>;
}
