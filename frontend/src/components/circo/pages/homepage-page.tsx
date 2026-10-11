"use client";

import {
  ArrowRightIcon,
  BeakerIcon,
  CircleStackIcon,
  ComputerDesktopIcon,
  KeyIcon,
} from "@heroicons/react/20/solid";
import type { PageId } from "@/components/circo/app-shell";
import { Badge, Button, Card } from "@/components/circo/primitives";
import { appConfig } from "@/config/app-config";

const capabilities = [
  {
    title: "Resources",
    description: "Register species and subjects, manage laboratory hardware, peripherals, software, and firmware.",
    icon: CircleStackIcon,
  },
  {
    title: "Method",
    description: "Define stimulation positions, dual-pin channels, species behaviors, and control shortcuts.",
    icon: KeyIcon,
  },
  {
    title: "Test",
    description: "Prepare experiments and plans, execute repeatable trials, annotate results, and export records.",
    icon: BeakerIcon,
  },
  {
    title: "Operation",
    description: "Generate stimulation signals, control networked boards, monitor cameras, and review system logs.",
    icon: ComputerDesktopIcon,
  },
];

const workflow = [
  "Register species, subjects, hardware, and software resources.",
  "Mark stimulation positions and define species-specific channels and behaviors.",
  "Create an experiment and prepare repeatable trial plans.",
  "Record, stimulate, review video, annotate responses, and save results.",
];

export function HomepagePage({ onNavigate }: { onNavigate: (page: PageId) => void }) {
  return <div className="grid min-w-0 gap-10">
    <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-950 px-6 py-10 text-white sm:px-10 sm:py-14">
      <Badge>Cyborg research platform</Badge>
      <h1 className="mt-6 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">{appConfig.name}</h1>
      <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-300 sm:text-lg">
        A local laboratory console for experimental planning, video recording, electrical stimulation, hardware management, and real-time biological control.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Button variant="secondary" onClick={() => onNavigate("guide")}>Get Started <ArrowRightIcon className="size-4" /></Button>
        <Button className="border border-zinc-700" onClick={() => onNavigate("signal-generation")}>Open Signal Generation</Button>
      </div>
    </section>

    <section>
      <p className="text-xs font-semibold uppercase tracking-[.18em] text-zinc-500">What it does</p>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight">One workspace for the complete experiment lifecycle</h2>
      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {capabilities.map(({ title, description, icon: Icon }) => <Card key={title} className="min-h-52">
          <span className="grid size-10 place-items-center rounded-lg bg-zinc-100"><Icon className="size-5" /></span>
          <h3 className="mt-5 font-semibold">{title}</h3>
          <p className="mt-2 text-sm leading-6 text-zinc-500">{description}</p>
        </Card>)}
      </div>
    </section>

    <section className="grid gap-6 rounded-2xl border border-zinc-200 bg-zinc-50 p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] lg:p-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[.18em] text-zinc-500">Workflow</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">From setup to recorded evidence</h2>
        <p className="mt-3 text-sm leading-6 text-zinc-500">Cyborg Lab keeps method configuration, trial execution, video evidence, and annotations connected in one local database.</p>
      </div>
      <ol className="grid gap-3">
        {workflow.map((step, index) => <li key={step} className="flex gap-4 rounded-xl border border-zinc-200 bg-white p-4 text-sm leading-6">
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-zinc-950 text-xs font-semibold text-white">{index + 1}</span>
          <span>{step}</span>
        </li>)}
      </ol>
    </section>
  </div>;
}
