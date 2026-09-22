import { PageHeader } from "@/components/circo/page-elements";
import { EmptyState } from "@/components/circo/ui";

export function LiveControlPage() {
  return <div className="grid gap-8">
    <PageHeader eyebrow="实测" title="实时控制" subtitle="面向实时设备操控与状态反馈的独立工作区。" />
    <EmptyState title="实时控制尚未实现" description="该页面已与信号生发分离，后续实时控制功能将在这里独立开发。" />
  </div>;
}
