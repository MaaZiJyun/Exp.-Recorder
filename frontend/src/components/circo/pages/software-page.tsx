import { PageHeader } from "@/components/circo/page-elements";
import { Card } from "@/components/circo/primitives";
import { appConfig } from "@/config/app-config";

export function SoftwarePage() {
  return <div className="grid gap-8">
    <PageHeader eyebrow="Resources" title={appConfig.software.pageTitle} subtitle={appConfig.software.pageSubtitle} />
    <div className="grid gap-4 md:grid-cols-3">
      {appConfig.software.components.map(({ name, value }) => <Card className="p-5" key={name}><p className="text-sm text-zinc-500">{name}</p><p className="mt-2 text-lg font-semibold">{value}</p></Card>)}
    </div>
  </div>;
}
