"use client";

import { useState } from "react";
import type { RecorderContext } from "@/app/use-recorder";
import { PageHeader } from "@/components/circo/page-elements";
import { Notice } from "@/components/circo/recorder/notice";
import { PositionCardsPanel } from "@/components/circo/recorder/positions-panel";
import { Card, Field, Select } from "@/components/circo/primitives";

export function PositionsPage({ ctx }: { ctx: RecorderContext }) {
  const { speciesRecords, notice, setNotice } = ctx;
  const [selectedSpeciesCode, setSelectedSpeciesCode] = useState<string | null>(null);
  const speciesCode = selectedSpeciesCode && (selectedSpeciesCode === "__general__" || speciesRecords.some((species) => species.code === selectedSpeciesCode))
    ? selectedSpeciesCode
    : speciesRecords[0]?.code ?? "__general__";

  return <div className="grid min-w-0 gap-6">
    <PageHeader eyebrow="Filters" title="Positions" subtitle="Manage reusable stimulation positions and image markers." />
    <Notice notice={notice} onClose={() => setNotice(null)} />
    <Card><Field label="Species"><Select value={speciesCode} onChange={(event) => setSelectedSpeciesCode(event.target.value)}><option value="__general__">General positions</option>{speciesRecords.map((species) => <option key={species.species_id} value={species.code}>{species.code} · {species.scientific_name}</option>)}</Select></Field></Card>
    <PositionCardsPanel ctx={ctx} speciesCode={speciesCode} />
  </div>;
}
