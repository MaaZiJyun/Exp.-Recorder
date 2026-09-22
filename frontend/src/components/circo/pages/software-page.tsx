import { PageHeader } from "@/components/circo/page-elements";
import { Card } from "@/components/circo/ui";

export function SoftwarePage() {
  return <div className="grid gap-8">
    <PageHeader eyebrow="资源" title="软件" subtitle="查看当前实验系统的软件组件。" />
    <div className="grid gap-4 md:grid-cols-3">
      {[['Web 控制台', 'Next.js'], ['实验 API', 'FastAPI'], ['数据存储', 'SQLite']].map(([name, value]) => <Card className="p-5" key={name}><p className="text-sm text-zinc-500">{name}</p><p className="mt-2 text-lg font-semibold">{value}</p></Card>)}
    </div>
  </div>;
}
