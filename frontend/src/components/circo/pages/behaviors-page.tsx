"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { PlusIcon } from "@heroicons/react/20/solid";
import { api } from "@/app/lib";
import type { Behavior, SpeciesRecord, StimulationChannel } from "@/app/types";
import { DataTable, type DataTableColumn } from "@/components/circo/data-table";
import { PageHeader, SectionHeader } from "@/components/circo/page-elements";
import { Alert, Badge, Button, Card, Dialog, Field, Input, Select } from "@/components/circo/primitives";

type BehaviorDraft = {
  species_id: string;
  name: string;
  channel_id: string;
  default_shortcut: string;
  status: "off" | "on";
};

const emptyDraft: BehaviorDraft = {
  species_id: "",
  name: "",
  channel_id: "",
  default_shortcut: "W",
  status: "on",
};

const shortcutKeys = ["W", "A", "S", "D", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"];

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return <div className="flex items-start justify-between gap-4 border-b border-zinc-200/70 py-2 last:border-0"><dt className="text-zinc-500">{label}</dt><dd className="min-w-0 text-right font-medium text-zinc-900">{children}</dd></div>;
}

function BehaviorInfo({ behavior }: { behavior: Behavior }) {
  return <dl>
    <InfoRow label="ID">{behavior.id}</InfoRow>
    <InfoRow label="Name">{behavior.name}</InfoRow>
    <InfoRow label="Species">{behavior.species_code} · <span className="italic">{behavior.species_scientific_name}</span></InfoRow>
    <InfoRow label="Channel">#{behavior.channel_id} · {behavior.channel_name}</InfoRow>
    <InfoRow label="Default Shortcut">{behavior.default_shortcut}</InfoRow>
    <InfoRow label="Status"><Badge tone={behavior.status === "on" ? "success" : "neutral"}>{behavior.status.toUpperCase()}</Badge></InfoRow>
  </dl>;
}

const columns: DataTableColumn<Behavior>[] = [
  { key: "id", header: "ID", cell: (behavior) => behavior.id, searchValue: (behavior) => behavior.id },
  { key: "name", header: "Behavior", cell: (behavior) => <strong>{behavior.name}</strong>, searchValue: (behavior) => behavior.name },
  { key: "species", header: "Species", cell: (behavior) => <Badge>{behavior.species_code}</Badge>, searchValue: (behavior) => `${behavior.species_code} ${behavior.species_scientific_name}` },
  { key: "channel", header: "Channel", cell: (behavior) => `#${behavior.channel_id} · ${behavior.channel_name}`, searchValue: (behavior) => `${behavior.channel_id} ${behavior.channel_name}` },
  { key: "shortcut", header: "Shortcut", cell: (behavior) => <span className="font-mono text-xs">{behavior.default_shortcut}</span>, searchValue: (behavior) => behavior.default_shortcut },
  { key: "status", header: "Status", cell: (behavior) => <Badge tone={behavior.status === "on" ? "success" : "neutral"}>{behavior.status.toUpperCase()}</Badge>, searchValue: (behavior) => behavior.status },
];

export function BehaviorsPage() {
  const [behaviors, setBehaviors] = useState<Behavior[]>([]);
  const [species, setSpecies] = useState<SpeciesRecord[]>([]);
  const [channels, setChannels] = useState<StimulationChannel[]>([]);
  const [selectedSpeciesId, setSelectedSpeciesId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editorId, setEditorId] = useState<number | null | undefined>(undefined);
  const [draft, setDraft] = useState<BehaviorDraft>(emptyDraft);
  const [message, setMessage] = useState<{ tone: "success" | "danger" | "warning"; text: string } | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [behaviorRecords, speciesRecords, channelRecords] = await Promise.all([
        api<Behavior[]>("/behaviors"),
        api<SpeciesRecord[]>("/species"),
        api<StimulationChannel[]>("/stimulation-channels"),
      ]);
      setBehaviors(behaviorRecords);
      setSpecies(speciesRecords);
      setChannels(channelRecords);
    } catch (error) {
      setMessage({ tone: "danger", text: error instanceof Error ? error.message : "Failed to load behaviors." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadData(), 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  const activeSpeciesId = selectedSpeciesId && species.some((record) => String(record.species_id) === selectedSpeciesId)
    ? selectedSpeciesId
    : species[0]?.species_id.toString() ?? "";
  const activeSpecies = species.find((record) => String(record.species_id) === activeSpeciesId);
  const filteredBehaviors = behaviors.filter((behavior) => String(behavior.species_id) === activeSpeciesId);
  const availableChannels = channels.filter((channel) => String(channel.species_id) === draft.species_id);

  const newBehavior = () => {
    setDraft({ ...emptyDraft, species_id: activeSpeciesId });
    setEditorId(null);
  };

  const editBehavior = (behavior: Behavior) => {
    setDraft({
      species_id: String(behavior.species_id),
      name: behavior.name,
      channel_id: String(behavior.channel_id),
      default_shortcut: behavior.default_shortcut,
      status: behavior.status,
    });
    setEditorId(behavior.id);
  };

  const saveBehavior = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const creating = editorId === null;
      await api(creating ? "/behaviors" : `/behaviors/${editorId}`, {
        method: creating ? "POST" : "PUT",
        body: JSON.stringify({
          species_id: Number(draft.species_id),
          name: draft.name,
          channel_id: Number(draft.channel_id),
          default_shortcut: draft.default_shortcut,
          status: draft.status,
        }),
      });
      setEditorId(undefined);
      setMessage({ tone: "success", text: creating ? "Behavior created." : "Behavior updated." });
      await loadData();
    } catch (error) {
      setMessage({ tone: "danger", text: error instanceof Error ? error.message : "Failed to save behavior." });
    } finally {
      setSaving(false);
    }
  };

  const deleteBehavior = async (behavior: Behavior) => {
    if (!window.confirm(`Delete behavior “${behavior.name}”?`)) return;
    try {
      await api(`/behaviors/${behavior.id}`, { method: "DELETE" });
      setMessage({ tone: "success", text: "Behavior deleted." });
      await loadData();
    } catch (error) {
      setMessage({ tone: "danger", text: error instanceof Error ? error.message : "Failed to delete behavior." });
    }
  };

  const canSave = Boolean(draft.species_id && draft.name.trim() && draft.channel_id && draft.default_shortcut);

  return <div className="grid min-w-0 gap-8">
    <PageHeader eyebrow="Method" title="Behavior" subtitle="Define species-specific behaviors, their stimulation channels, shortcuts, and availability in Live Control." />
    {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}
    <Card>
      <Field label="Species">
        <Select value={activeSpeciesId} onChange={(event) => { setSelectedSpeciesId(event.target.value); setEditorId(undefined); }}>
          {!species.length ? <option value="">No species registered</option> : null}
          {species.map((record) => <option key={record.species_id} value={record.species_id}>{record.code} · {record.scientific_name}</option>)}
        </Select>
      </Field>
    </Card>
    <Card>
      <SectionHeader
        title="Behaviors"
        subtitle={activeSpecies ? `${activeSpecies.code} · ${filteredBehaviors.length} registered behavior${filteredBehaviors.length === 1 ? "" : "s"}` : "Select a species"}
        action={<Button onClick={newBehavior} disabled={!activeSpeciesId}><PlusIcon className="size-4" />Add Behavior</Button>}
      />
      {!channels.some((channel) => String(channel.species_id) === activeSpeciesId) && !loading ? <Alert tone="warning">Create a Channel for this Species before registering a Behavior.</Alert> : null}
      {loading ? <p className="py-10 text-center text-sm text-zinc-500">Loading…</p> : <DataTable
        rows={filteredBehaviors}
        columns={columns}
        getRowId={(behavior) => behavior.id}
        getInfoTitle={(behavior) => behavior.name}
        getSearchText={(behavior) => `${behavior.id} ${behavior.name} ${behavior.species_code} ${behavior.species_scientific_name} ${behavior.channel_name} ${behavior.default_shortcut} ${behavior.status}`}
        searchPlaceholder="Search behaviors by name, channel, shortcut, or status..."
        emptyTitle="No behaviors"
        emptyDescription="Register a species-specific behavior to make it available in Live Control."
        renderInfo={(behavior) => <BehaviorInfo behavior={behavior} />}
        onUpdate={editBehavior}
        onDelete={deleteBehavior}
      />}
    </Card>

    <Dialog open={editorId !== undefined} title={editorId === null ? "Add Behavior" : "Update Behavior"} closeLabel="Close" onClose={() => setEditorId(undefined)}>
      <form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); void saveBehavior(); }}>
        <Field label="Species">
          <Select required disabled value={draft.species_id}>
            <option value="">Select a species…</option>
            {species.map((record) => <option key={record.species_id} value={record.species_id}>{record.code} · {record.scientific_name}</option>)}
          </Select>
        </Field>
        <Field label="Name"><Input required maxLength={200} placeholder="e.g. forward" value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} /></Field>
        <Field label="Channel">
          <Select required value={draft.channel_id} onChange={(event) => setDraft((current) => ({ ...current, channel_id: event.target.value }))}>
            <option value="">Select a channel…</option>
            {availableChannels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.id} · {channel.channel_name}</option>)}
          </Select>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Default Shortcut">
            <Select value={draft.default_shortcut} onChange={(event) => setDraft((current) => ({ ...current, default_shortcut: event.target.value }))}>
              {shortcutKeys.map((key) => <option key={key} value={key}>{key}</option>)}
            </Select>
          </Field>
          <Field label="Status">
            <Select value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value as "off" | "on" }))}>
              <option value="on">On</option>
              <option value="off">Off</option>
            </Select>
          </Field>
        </div>
        <p className="text-xs leading-5 text-zinc-500">Only behaviors with status On are shown and accepted in Live Control.</p>
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setEditorId(undefined)}>Cancel</Button><Button type="submit" disabled={saving || !canSave}>{saving ? "Saving…" : "Save Behavior"}</Button></div>
      </form>
    </Dialog>
  </div>;
}
