"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { PlusIcon } from "@heroicons/react/20/solid";
import { api } from "@/app/lib";
import type { SpeciesRecord, StimulationChannel, StimulationPosition } from "@/app/types";
import { DataTable, type DataTableColumn } from "@/components/circo/data-table";
import { PageHeader, SectionHeader } from "@/components/circo/page-elements";
import { Alert, Badge, Button, Card, Dialog, Field, Input, Select } from "@/components/circo/primitives";

type ChannelDraft = {
  species_id: string;
  channel_name: string;
  channel_pin_1: string;
  channel_pin_2: string;
  channel_pin_1_position_id: string;
  channel_pin_2_position_id: string;
  channel_freq_hz: string;
  channel_stim_duration_ms: string;
};

const emptyDraft: ChannelDraft = {
  species_id: "",
  channel_name: "",
  channel_pin_1: "0",
  channel_pin_2: "1",
  channel_pin_1_position_id: "",
  channel_pin_2_position_id: "",
  channel_freq_hz: "50",
  channel_stim_duration_ms: "500",
};

const pinOptions = Array.from({ length: 9 }, (_, index) => index);

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return <div className="flex items-start justify-between gap-4 border-b border-zinc-200/70 py-2 last:border-0"><dt className="text-zinc-500">{label}</dt><dd className="min-w-0 text-right font-medium text-zinc-900">{children}</dd></div>;
}

function ChannelInfo({ channel }: { channel: StimulationChannel }) {
  return <dl>
    <InfoRow label="ID">{channel.id}</InfoRow>
    <InfoRow label="Name">{channel.channel_name}</InfoRow>
    <InfoRow label="Species">{channel.species_code} · <span className="italic">{channel.species_scientific_name}</span></InfoRow>
    <InfoRow label={`D${channel.channel_pin_1}`}>{channel.channel_pin_1_position_code}</InfoRow>
    <InfoRow label={`D${channel.channel_pin_2}`}>{channel.channel_pin_2_position_code}</InfoRow>
    <InfoRow label="Frequency">{channel.channel_freq_hz} Hz</InfoRow>
    <InfoRow label="Stim Duration">{channel.channel_stim_duration_ms} ms</InfoRow>
    <InfoRow label="Created">{new Date(channel.created_at).toLocaleString()}</InfoRow>
    <InfoRow label="Updated">{new Date(channel.updated_at).toLocaleString()}</InfoRow>
  </dl>;
}

const columns: DataTableColumn<StimulationChannel>[] = [
  { key: "id", header: "ID", cell: (channel) => channel.id, searchValue: (channel) => channel.id },
  { key: "name", header: "Channel", cell: (channel) => <strong>{channel.channel_name}</strong>, searchValue: (channel) => channel.channel_name },
  { key: "species", header: "Species", cell: (channel) => <Badge>{channel.species_code}</Badge>, searchValue: (channel) => `${channel.species_code} ${channel.species_scientific_name}` },
  { key: "pin1", header: "Pin 1 → Position", cell: (channel) => <span className="font-mono text-xs">D{channel.channel_pin_1} → {channel.channel_pin_1_position_code}</span>, searchValue: (channel) => `D${channel.channel_pin_1} ${channel.channel_pin_1_position_code}` },
  { key: "pin2", header: "Pin 2 → Position", cell: (channel) => <span className="font-mono text-xs">D{channel.channel_pin_2} → {channel.channel_pin_2_position_code}</span>, searchValue: (channel) => `D${channel.channel_pin_2} ${channel.channel_pin_2_position_code}` },
  { key: "frequency", header: "Frequency", cell: (channel) => `${channel.channel_freq_hz} Hz`, searchValue: (channel) => channel.channel_freq_hz },
  { key: "duration", header: "Duration", cell: (channel) => `${channel.channel_stim_duration_ms} ms`, searchValue: (channel) => channel.channel_stim_duration_ms },
];

export function ChannelsPage() {
  const [channels, setChannels] = useState<StimulationChannel[]>([]);
  const [species, setSpecies] = useState<SpeciesRecord[]>([]);
  const [positions, setPositions] = useState<StimulationPosition[]>([]);
  const [selectedSpeciesId, setSelectedSpeciesId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editorId, setEditorId] = useState<number | null | undefined>(undefined);
  const [draft, setDraft] = useState<ChannelDraft>(emptyDraft);
  const [message, setMessage] = useState<{ tone: "success" | "danger" | "warning"; text: string } | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [channelRecords, speciesRecords, positionRecords] = await Promise.all([
        api<StimulationChannel[]>("/stimulation-channels"),
        api<SpeciesRecord[]>("/species"),
        api<StimulationPosition[]>("/stimulation-positions"),
      ]);
      setChannels(channelRecords);
      setSpecies(speciesRecords);
      setPositions(positionRecords);
    } catch (error) {
      setMessage({ tone: "danger", text: error instanceof Error ? error.message : "Failed to load stimulation channels." });
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
  const filteredChannels = channels.filter((channel) => String(channel.species_id) === activeSpeciesId);
  const selectedSpecies = species.find((record) => String(record.species_id) === draft.species_id);
  const availablePositions = useMemo(
    () => positions.filter((position) => position.species === selectedSpecies?.code),
    [positions, selectedSpecies?.code],
  );

  const newChannel = () => {
    setDraft({ ...emptyDraft, species_id: activeSpeciesId });
    setEditorId(null);
  };

  const editChannel = (channel: StimulationChannel) => {
    setDraft({
      species_id: String(channel.species_id),
      channel_name: channel.channel_name,
      channel_pin_1: String(channel.channel_pin_1),
      channel_pin_2: String(channel.channel_pin_2),
      channel_pin_1_position_id: String(channel.channel_pin_1_position_id),
      channel_pin_2_position_id: String(channel.channel_pin_2_position_id),
      channel_freq_hz: String(channel.channel_freq_hz),
      channel_stim_duration_ms: String(channel.channel_stim_duration_ms),
    });
    setEditorId(channel.id);
  };

  const saveChannel = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const creating = editorId === null;
      await api(creating ? "/stimulation-channels" : `/stimulation-channels/${editorId}`, {
        method: creating ? "POST" : "PUT",
        body: JSON.stringify({
          species_id: Number(draft.species_id),
          channel_name: draft.channel_name,
          channel_pin_1: Number(draft.channel_pin_1),
          channel_pin_2: Number(draft.channel_pin_2),
          channel_pin_1_position_id: Number(draft.channel_pin_1_position_id),
          channel_pin_2_position_id: Number(draft.channel_pin_2_position_id),
          channel_freq_hz: Number(draft.channel_freq_hz),
          channel_stim_duration_ms: Number(draft.channel_stim_duration_ms),
        }),
      });
      setEditorId(undefined);
      setMessage({ tone: "success", text: creating ? "Stimulation channel created." : "Stimulation channel updated." });
      await loadData();
    } catch (error) {
      setMessage({ tone: "danger", text: error instanceof Error ? error.message : "Failed to save stimulation channel." });
    } finally {
      setSaving(false);
    }
  };

  const deleteChannel = async (channel: StimulationChannel) => {
    if (!window.confirm(`Delete channel “${channel.channel_name}”?`)) return;
    try {
      await api(`/stimulation-channels/${channel.id}`, { method: "DELETE" });
      setMessage({ tone: "success", text: "Stimulation channel deleted." });
      await loadData();
    } catch (error) {
      setMessage({ tone: "danger", text: error instanceof Error ? error.message : "Failed to delete stimulation channel." });
    }
  };

  const duplicatePins = draft.channel_pin_1 === draft.channel_pin_2;
  const duplicatePositions = Boolean(draft.channel_pin_1_position_id) && draft.channel_pin_1_position_id === draft.channel_pin_2_position_id;
  const canSave = Boolean(
    draft.species_id && draft.channel_name.trim() && draft.channel_pin_1_position_id &&
    draft.channel_pin_2_position_id && draft.channel_freq_hz && draft.channel_stim_duration_ms &&
    !duplicatePins && !duplicatePositions,
  );

  return <div className="grid min-w-0 gap-8">
    <PageHeader eyebrow="Filters" title="Channels" subtitle="Register species-specific stimulation channels, pin mappings, positions, frequency, and duration." />
    {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}
    <Card>
      <Field label="Species">
        <Select
          value={activeSpeciesId}
          onChange={(event) => {
            setSelectedSpeciesId(event.target.value);
            setEditorId(undefined);
          }}
        >
          {!species.length ? <option value="">No species registered</option> : null}
          {species.map((record) => <option key={record.species_id} value={record.species_id}>{record.code} · {record.scientific_name}</option>)}
        </Select>
      </Field>
    </Card>
    <Card>
      <SectionHeader
        title="Stimulation Channels"
        subtitle={activeSpecies ? `${activeSpecies.code} · ${filteredChannels.length} registered channel${filteredChannels.length === 1 ? "" : "s"}` : "Select a species"}
        action={<Button onClick={newChannel} disabled={!activeSpeciesId}><PlusIcon className="size-4" />Add Channel</Button>}
      />
      {!species.length && !loading ? <Alert tone="warning">Create a Species and at least two species-specific Positions before registering a Channel.</Alert> : null}
      {loading ? <p className="py-10 text-center text-sm text-zinc-500">Loading…</p> : <DataTable
        rows={filteredChannels}
        columns={columns}
        getRowId={(channel) => channel.id}
        getInfoTitle={(channel) => channel.channel_name}
        getSearchText={(channel) => `${channel.id} ${channel.channel_name} ${channel.species_code} ${channel.species_scientific_name} D${channel.channel_pin_1} ${channel.channel_pin_1_position_code} D${channel.channel_pin_2} ${channel.channel_pin_2_position_code} ${channel.channel_freq_hz} ${channel.channel_stim_duration_ms}`}
        searchPlaceholder="Search channels by name, species, pin, or position..."
        emptyTitle="No stimulation channels"
        emptyDescription="Register a species-specific channel to use it in Live Control."
        renderInfo={(channel) => <ChannelInfo channel={channel} />}
        onUpdate={editChannel}
        onDelete={deleteChannel}
      />}
    </Card>

    <Dialog open={editorId !== undefined} title={editorId === null ? "Add Channel" : "Update Channel"} closeLabel="Close" onClose={() => setEditorId(undefined)}>
      <form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); void saveChannel(); }}>
        <Field label="Species">
          <Select required disabled value={draft.species_id}>
            <option value="">Select a species…</option>
            {species.map((record) => <option key={record.species_id} value={record.species_id}>{record.code} · {record.scientific_name}</option>)}
          </Select>
        </Field>
        <Field label="Channel Name"><Input required maxLength={200} value={draft.channel_name} onChange={(event) => setDraft((current) => ({ ...current, channel_name: event.target.value }))} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Pin 1"><Select value={draft.channel_pin_1} onChange={(event) => setDraft((current) => ({ ...current, channel_pin_1: event.target.value }))}>{pinOptions.map((pin) => <option key={pin} value={pin}>D{pin}</option>)}</Select></Field>
          <Field label="Pin 1 Position"><Select required value={draft.channel_pin_1_position_id} onChange={(event) => setDraft((current) => ({ ...current, channel_pin_1_position_id: event.target.value }))}><option value="">Select position…</option>{availablePositions.map((position) => <option key={position.position_id} value={position.position_id}>{position.code}</option>)}</Select></Field>
          <Field label="Pin 2"><Select value={draft.channel_pin_2} onChange={(event) => setDraft((current) => ({ ...current, channel_pin_2: event.target.value }))}>{pinOptions.map((pin) => <option key={pin} value={pin}>D{pin}</option>)}</Select></Field>
          <Field label="Pin 2 Position"><Select required value={draft.channel_pin_2_position_id} onChange={(event) => setDraft((current) => ({ ...current, channel_pin_2_position_id: event.target.value }))}><option value="">Select position…</option>{availablePositions.map((position) => <option key={position.position_id} value={position.position_id}>{position.code}</option>)}</Select></Field>
        </div>
        {duplicatePins ? <Alert tone="danger">Pin 1 and Pin 2 must be different.</Alert> : null}
        {duplicatePositions ? <Alert tone="danger">Pin 1 and Pin 2 must use different positions.</Alert> : null}
        {draft.species_id && availablePositions.length < 2 ? <Alert tone="warning">This Species needs at least two registered Positions before a Channel can be saved.</Alert> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Frequency (Hz)"><Input required type="number" min="0.001" step="any" value={draft.channel_freq_hz} onChange={(event) => setDraft((current) => ({ ...current, channel_freq_hz: event.target.value }))} /></Field>
          <Field label="Stimulation Duration (ms)"><Input required type="number" min="1" step="1" value={draft.channel_stim_duration_ms} onChange={(event) => setDraft((current) => ({ ...current, channel_stim_duration_ms: event.target.value }))} /></Field>
        </div>
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setEditorId(undefined)}>Cancel</Button><Button type="submit" disabled={saving || !canSave}>{saving ? "Saving…" : "Save Channel"}</Button></div>
      </form>
    </Dialog>
  </div>;
}
