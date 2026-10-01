"use client";

import { PlusIcon } from "@heroicons/react/20/solid";
import type { RecorderContext } from "@/app/use-recorder";
import type { StimulationPosition } from "@/app/types";
import { DataTable, type DataTableColumn } from "@/components/circo/data-table";
import { Badge, Button, Card, Dialog, EmptyState, Field, Input, Select, Textarea } from "@/components/circo/primitives";

const columns: DataTableColumn<StimulationPosition>[] = [
  { key: "id", header: "ID", cell: (row) => row.position_id, searchValue: (row) => row.position_id },
  { key: "code", header: "Code", cell: (row) => <Badge tone="info">{row.code}</Badge>, searchValue: (row) => row.code },
  { key: "description", header: "Description", cell: (row) => <span className="block max-w-md truncate">{row.description || "—"}</span>, searchValue: (row) => row.description },
  { key: "marked", header: "Marked", cell: (row) => <Badge tone={row.mark ? "success" : "warning"}>{row.mark ? "Yes" : "No"}</Badge>, sortValue: (row) => Boolean(row.mark), searchValue: (row) => row.mark ? "marked" : "unmarked" },
  { key: "trials", header: "Trials", cell: (row) => row.trial_count, sortValue: (row) => row.trial_count, searchValue: (row) => row.trial_count },
];

function PositionOverview({ positions }: { positions: StimulationPosition[] }) {
  const imageGroups = positions.filter((position) => position.image && position.image_id !== null).filter((position, index, records) => records.findIndex((candidate) => candidate.image_id === position.image_id) === index);
  const unmarked = positions.filter((position) => !position.mark);

  if (!positions.length) return <EmptyState title="No positions" description="No stimulation positions exist for this species." />;
  return <div className="grid gap-4">
    {imageGroups.map((imagePosition) => <div key={imagePosition.image_id} className="relative overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100">
      <img src={imagePosition.image ?? ""} alt={`${imagePosition.species ?? "General"} stimulation positions`} className="block h-auto w-full" />
      {positions.filter((position) => position.image_id === imagePosition.image_id && position.mark).map((position) => <span key={position.position_id} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${(position.mark?.x ?? 0) * 100}%`, top: `${(position.mark?.y ?? 0) * 100}%` }}>
        <i className="block size-3.5 rounded-full border-2 border-white bg-red-500 shadow" />
        <b className="absolute left-1/2 top-full mt-1 -translate-x-1/2 rounded bg-zinc-950 px-1.5 py-1 text-[9px] leading-none text-white shadow">{position.code}</b>
      </span>)}
    </div>)}
    {imageGroups.length === 0 ? <EmptyState title="No reference image" description="These positions do not have a species image yet." /> : null}
    <div className="flex flex-wrap gap-1.5">{positions.map((position) => <Badge key={position.position_id} tone={position.mark ? "info" : "warning"}>{position.code}</Badge>)}</div>
    {unmarked.length ? <p className="text-xs text-amber-700">{unmarked.length} position{unmarked.length === 1 ? " is" : "s are"} not marked on an image.</p> : null}
  </div>;
}

function PositionInfo({ position }: { position: StimulationPosition }) {
  return <div className="grid gap-3">
    {position.image ? <div className="relative overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100">
      <img src={position.image} alt={`Position ${position.code}`} className="max-h-52 w-full object-contain" />
      {position.mark ? <span className="absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-red-500 shadow" style={{ left: `${position.mark.x * 100}%`, top: `${position.mark.y * 100}%` }} /> : null}
    </div> : null}
    <dl className="grid gap-2 text-sm">
      <div><dt className="text-xs text-zinc-500">Code</dt><dd className="mt-1"><Badge tone="info">{position.code}</Badge></dd></div>
      <div><dt className="text-xs text-zinc-500">Species</dt><dd className="mt-1">{position.species || "General"}</dd></div>
      <div><dt className="text-xs text-zinc-500">Description</dt><dd className="mt-1 whitespace-pre-wrap">{position.description || "No description"}</dd></div>
    </dl>
  </div>;
}

export function PositionCardsPanel({ ctx, speciesCode }: { ctx: RecorderContext; speciesCode: string }) {
  const {
    positions, running, positionDeleting, speciesRecords, speciesImageOptions,
    editingPosition, positionEditorId, positionDraft, positionSaving,
    newPosition, editPosition, deletePosition, setPositionDraft,
    setEditingPosition, readPositionImage, savePosition,
  } = ctx;
  const filteredPositions = positions.filter((position) => speciesCode === "__general__" ? !position.species : position.species === speciesCode);
  const selectedSpecies = speciesRecords.find((species) => species.code === speciesCode);

  const createPosition = () => {
    newPosition();
    if (selectedSpecies) setPositionDraft((current) => ({ ...current, species: selectedSpecies.code, image: selectedSpecies.image ?? "", mark: null }));
  };

  return <>
    <Card>
      <div className="mb-5 flex items-center justify-between gap-4">
        <div><h2 className="text-base font-semibold">Stimulation Positions</h2><p className="mt-1 text-sm text-zinc-500">{filteredPositions.length} position{filteredPositions.length === 1 ? "" : "s"} for {selectedSpecies?.scientific_name ?? "general use"}</p></div>
        <Button onClick={createPosition} disabled={running}><PlusIcon className="size-4" />New Position</Button>
      </div>
      <DataTable
        rows={filteredPositions}
        columns={columns}
        getRowId={(position) => position.position_id}
        getInfoTitle={(position) => position.code}
        defaultInfoTitle="All Stimulation Points"
        defaultInfo={<PositionOverview positions={filteredPositions} />}
        getSearchText={(position) => `${position.position_id} ${position.code} ${position.description ?? ""}`}
        searchPlaceholder="Search positions by code or description..."
        emptyTitle="No positions"
        emptyDescription="Create and mark stimulation positions for this species."
        renderInfo={(position) => <PositionInfo position={position} />}
        onUpdate={editPosition}
        onDelete={deletePosition}
        isUpdateDisabled={() => running}
        isDeleteDisabled={(position) => running || position.trial_count > 0 || positionDeleting === position.position_id}
      />
    </Card>

    <Dialog open={editingPosition} title={positionEditorId === null ? "New Position" : "Update Position"} closeLabel="Close" onClose={() => setEditingPosition(false)}>
      <form className="grid gap-5" onSubmit={(event) => { event.preventDefault(); void savePosition(); }}>
        <Field label="Code" hint="For example, A1. Use letters, numbers, underscores, and hyphens only."><Input required value={positionDraft.code} onChange={(event) => setPositionDraft((current) => ({ ...current, code: event.target.value }))} placeholder="A1" autoFocus /></Field>
        <Field label="Description"><Textarea value={positionDraft.description} onChange={(event) => setPositionDraft((current) => ({ ...current, description: event.target.value }))} placeholder="Position description, anatomical landmark, or handling notes..." /></Field>
        <Field label="Species" hint="A position belongs to one species."><Select value={positionDraft.species} onChange={(event) => setPositionDraft((current) => ({ ...current, species: event.target.value, image: speciesRecords.find((species) => species.code === event.target.value)?.image ?? "", mark: null }))}><option value="">General position</option>{speciesRecords.map((species) => <option key={species.species_id} value={species.code}>{species.code} · {species.scientific_name}</option>)}</Select></Field>
        <Field label="Image" hint="The selected species supplies its reference image." className="hidden">
          {speciesImageOptions.length > 0 ? <Select value={speciesImageOptions.find((species) => species.image === positionDraft.image)?.species_id?.toString() ?? ""} onChange={(event) => {
            const selectedImage = speciesImageOptions.find((species) => String(species.species_id) === event.target.value);
            setPositionDraft((current) => ({ ...current, image: selectedImage?.image ?? "", mark: null }));
          }}><option value="">Select a species image...</option>{speciesImageOptions.map((species) => <option key={species.species_id} value={species.species_id}>{species.code} · {species.scientific_name}</option>)}</Select> : null}
          <Input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => readPositionImage(event.target.files?.[0])} />
        </Field>
        {positionDraft.image ? <div className="grid gap-3"><p className="text-xs text-zinc-500">Click the image to place the mark.</p><div className="relative mx-auto w-fit max-w-full overflow-hidden rounded-xl border border-zinc-200">
          <img src={positionDraft.image} alt="Position preview" className="block max-h-64 max-w-full cursor-crosshair" onClick={(event) => { const bounds = event.currentTarget.getBoundingClientRect(); setPositionDraft((current) => ({ ...current, mark: { x: (event.clientX - bounds.left) / bounds.width, y: (event.clientY - bounds.top) / bounds.height } })); }} />
          {positionDraft.mark ? <span className="pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-red-500 shadow" style={{ left: `${positionDraft.mark.x * 100}%`, top: `${positionDraft.mark.y * 100}%` }} /> : null}
        </div></div> : null}
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setEditingPosition(false)}>Cancel</Button><Button type="submit" disabled={positionSaving}>{positionSaving ? "Saving..." : "Save Position"}</Button></div>
      </form>
    </Dialog>
  </>;
}
