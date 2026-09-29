"use client";

import { ArrowRightIcon } from "@heroicons/react/20/solid";
import type { PageId } from "@/components/circo/app-shell";
import { PageHeader } from "@/components/circo/page-elements";
import { Card } from "@/components/circo/primitives";
import { appConfig } from "@/config/app-config";

const sections: Array<{
  title: string;
  description: string;
  links: Array<[PageId, string]>;
}> = [
  {
    title: "Resources",
    description: "Manage biological subjects, inventory hardware, and deployable software.",
    links: [["species", "Species"], ["subjects", "Subjects"], ["hardware", "Hardware"], ["software", "Software"]],
  },
  {
    title: "Experiment Setup",
    description: "Prepare stimulation positions, plans, trials, and signal parameters.",
    links: [["positions", "Positions"], ["experiments", "Experiments"], ["plans", "Plans"], ["trials", "Trials"]],
  },
  {
    title: "Operation",
    description: "Connect to an online controller or inspect application activity.",
    links: [["signal-generation", "Signal Generation"], ["live-control", "Live Control"], ["logs", "Logs"]],
  },
];

export function IndexPage({ onNavigate }: { onNavigate: (page: PageId) => void }) {
  return <div className="grid gap-8">
    <PageHeader
      eyebrow={appConfig.name}
      title="Laboratory Console"
      subtitle="Choose a workspace to manage resources, prepare experiments, or control connected devices."
    />
    <div className="grid min-w-0 gap-4 lg:grid-cols-3">
      {sections.map((section) => <Card key={section.title} className="flex min-h-64 flex-col">
        <div>
          <h2 className="text-lg font-semibold">{section.title}</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-500">{section.description}</p>
        </div>
        <div className="mt-6 grid gap-2">
          {section.links.map(([page, label]) => <button
            key={page}
            type="button"
            onClick={() => onNavigate(page)}
            className="flex min-h-10 items-center justify-between rounded-lg border border-zinc-200 px-3 text-left text-sm font-medium text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-950"
          >
            {label}<ArrowRightIcon className="size-4 text-zinc-400" />
          </button>)}
        </div>
      </Card>)}
    </div>
  </div>;
}
