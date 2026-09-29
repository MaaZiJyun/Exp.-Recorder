"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { BoltIcon, PlusIcon } from "@heroicons/react/20/solid";
import { api } from "@/app/lib";
import { DataTable, type DataTableColumn } from "@/components/circo/data-table";
import { PageHeader, SectionHeader } from "@/components/circo/page-elements";
import { Alert, Badge, Button, Card, Dialog, Field, Input, Select, Textarea } from "@/components/circo/primitives";
import { appConfig } from "@/config/app-config";

type SoftwareRecord = {
  id: number;
  name: string;
  version: string;
  description: string | null;
  source_code_addr: string;
  supported_device: string;
  created_at: string;
  updated_at: string;
};

type SoftwareDraft = {
  name: string;
  version: string;
  description: string;
  source_code_addr: string;
  supported_device: string;
};

type SerialPort = {
  device: string;
  product: string | null;
  manufacturer: string | null;
  serial_number: string | null;
  reserved_by_experiment: boolean;
};

type FlashLog = { timestamp: string; stage: string; message: string };

type FlashJob = {
  job_id: string;
  software_id: number;
  software_name: string;
  software_version: string;
  port: string;
  status: "queued" | "running" | "completed" | "failed";
  stage: string;
  message: string;
  logs: FlashLog[];
  result: { passed: boolean; detail: string } | null;
};

type FlashPortsResponse = {
  ports: SerialPort[];
  arduino_cli_available: boolean;
  fqbn: string;
};

const emptyDraft: SoftwareDraft = {
  name: "",
  version: "",
  description: "",
  source_code_addr: "",
  supported_device: "",
};

const softwareColumns: DataTableColumn<SoftwareRecord>[] = [
  { key: "id", header: "ID", cell: (software) => software.id, searchValue: (software) => software.id },
  { key: "name", header: "Name", cell: (software) => <strong>{software.name}</strong>, searchValue: (software) => software.name },
  { key: "version", header: "Version", cell: (software) => <Badge tone="info">{software.version}</Badge>, searchValue: (software) => software.version },
  { key: "device", header: "Supported Device", cell: (software) => <Badge>{software.supported_device}</Badge>, searchValue: (software) => software.supported_device },
  { key: "description", header: "Description", cell: (software) => <span className="block max-w-md truncate">{software.description || "—"}</span>, searchValue: (software) => software.description },
  { key: "source", header: "Source", cell: (software) => <span className="block max-w-xs truncate font-mono text-xs">{software.source_code_addr}</span>, searchValue: (software) => software.source_code_addr },
];

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return <div className="grid gap-1 border-b border-zinc-200/70 py-2 last:border-0 dark:border-zinc-800"><dt className="text-xs text-zinc-500">{label}</dt><dd className="min-w-0 break-words font-medium text-zinc-900 dark:text-zinc-100">{children}</dd></div>;
}

function SoftwareInfo({ software }: { software: SoftwareRecord }) {
  return <dl>
    <InfoRow label="ID">{software.id}</InfoRow>
    <InfoRow label="Name">{software.name}</InfoRow>
    <InfoRow label="Version"><Badge tone="info">{software.version}</Badge></InfoRow>
    <InfoRow label="Supported Device"><Badge>{software.supported_device}</Badge></InfoRow>
    <InfoRow label="Description">{software.description || "—"}</InfoRow>
    <InfoRow label="Source Code Address"><span className="font-mono text-xs">{software.source_code_addr}</span></InfoRow>
    <InfoRow label="Created">{new Date(software.created_at).toLocaleString()}</InfoRow>
    <InfoRow label="Updated">{new Date(software.updated_at).toLocaleString()}</InfoRow>
  </dl>;
}

const wait = (milliseconds: number) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));

export function SoftwarePage() {
  const [records, setRecords] = useState<SoftwareRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "danger" | "warning"; text: string } | null>(null);
  const [editorId, setEditorId] = useState<number | null | undefined>(undefined);
  const [draft, setDraft] = useState<SoftwareDraft>(emptyDraft);
  const [flashRecord, setFlashRecord] = useState<SoftwareRecord | null>(null);
  const [ports, setPorts] = useState<SerialPort[]>([]);
  const [selectedPort, setSelectedPort] = useState("");
  const [portLoading, setPortLoading] = useState(false);
  const [cliAvailable, setCliAvailable] = useState(true);
  const [flashFqbn, setFlashFqbn] = useState("");
  const [flashJob, setFlashJob] = useState<FlashJob | null>(null);

  const loadSoftware = useCallback(async () => {
    setLoading(true);
    try {
      setRecords(await api<SoftwareRecord[]>("/software"));
    } catch (error) {
      setMessage({ tone: "danger", text: error instanceof Error ? error.message : "Failed to load software library." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadSoftware(), 0);
    return () => window.clearTimeout(timer);
  }, [loadSoftware]);

  const newSoftware = () => {
    setDraft(emptyDraft);
    setEditorId(null);
  };

  const editSoftware = (software: SoftwareRecord) => {
    setDraft({
      name: software.name,
      version: software.version,
      description: software.description ?? "",
      source_code_addr: software.source_code_addr,
      supported_device: software.supported_device,
    });
    setEditorId(software.id);
  };

  const saveSoftware = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const creating = editorId === null;
      await api(creating ? "/software" : `/software/${editorId}`, {
        method: creating ? "POST" : "PUT",
        body: JSON.stringify({
          ...draft,
          description: draft.description.trim() || null,
        }),
      });
      setEditorId(undefined);
      setMessage({ tone: "success", text: creating ? "Software added to the library." : "Software updated." });
      await loadSoftware();
    } catch (error) {
      setMessage({ tone: "danger", text: error instanceof Error ? error.message : "Failed to save software." });
    } finally {
      setSaving(false);
    }
  };

  const deleteSoftware = async (software: SoftwareRecord) => {
    if (!window.confirm(`Delete “${software.name} ${software.version}” from the software library?`)) return;
    try {
      await api(`/software/${software.id}`, { method: "DELETE" });
      setMessage({ tone: "success", text: "Software deleted." });
      await loadSoftware();
    } catch (error) {
      setMessage({ tone: "danger", text: error instanceof Error ? error.message : "Failed to delete software." });
    }
  };

  const openSource = async (software: SoftwareRecord) => {
    setMessage(null);
    try {
      if (/^https?:\/\//i.test(software.source_code_addr)) {
        window.open(software.source_code_addr, "_blank", "noopener,noreferrer");
      } else {
        await api(`/software/${software.id}/open-source`, { method: "POST" });
        setMessage({ tone: "success", text: `Opened the source for ${software.name}.` });
      }
    } catch (error) {
      setMessage({ tone: "danger", text: error instanceof Error ? error.message : "Unable to open source code." });
    }
  };

  const openFlash = async (software: SoftwareRecord) => {
    setFlashRecord(software);
    setFlashJob(null);
    setPorts([]);
    setSelectedPort("");
    setPortLoading(true);
    try {
      const response = await api<FlashPortsResponse>("/software-flash/ports");
      setPorts(response.ports);
      setCliAvailable(response.arduino_cli_available);
      setFlashFqbn(response.fqbn);
      const availablePort = response.ports.find((port) => !port.reserved_by_experiment);
      setSelectedPort(availablePort?.device ?? "");
    } catch (error) {
      setMessage({ tone: "danger", text: error instanceof Error ? error.message : "Unable to scan USB ports." });
    } finally {
      setPortLoading(false);
    }
  };

  const startFlash = async () => {
    if (!flashRecord || !selectedPort) return;
    setMessage(null);
    try {
      let job = await api<FlashJob>(`/software/${flashRecord.id}/flash`, {
        method: "POST",
        body: JSON.stringify({ port: selectedPort }),
      });
      setFlashJob(job);
      while (job.status === "queued" || job.status === "running") {
        await wait(700);
        job = await api<FlashJob>(`/software-flash/jobs/${job.job_id}`);
        setFlashJob(job);
      }
      if (job.status === "completed") {
        setMessage({ tone: "success", text: `${flashRecord.name} ${flashRecord.version} was flashed successfully.` });
      } else {
        setMessage({ tone: "danger", text: job.result?.detail || job.message || "Flash failed." });
      }
    } catch (error) {
      setMessage({ tone: "danger", text: error instanceof Error ? error.message : "Unable to flash program." });
    }
  };

  const flashing = flashJob?.status === "queued" || flashJob?.status === "running";

  return <div className="grid gap-8">
    <PageHeader eyebrow="Resources" title={appConfig.software.pageTitle} subtitle={appConfig.software.pageSubtitle} />
    {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}

    <Card>
      <SectionHeader
        title="Software Library"
        subtitle={`${records.length} program${records.length === 1 ? "" : "s"}`}
        action={<Button onClick={newSoftware}><PlusIcon className="size-4" />Add Software</Button>}
      />
      {loading ? <p className="py-10 text-center text-sm text-zinc-500">Loading…</p> : <DataTable
        rows={records}
        columns={softwareColumns}
        getRowId={(software) => software.id}
        getInfoTitle={(software) => `${software.name} ${software.version}`}
        getSearchText={(software) => `${software.id} ${software.name} ${software.version} ${software.supported_device} ${software.description ?? ""} ${software.source_code_addr}`}
        searchPlaceholder="Search software by name, version, device, description, or source..."
        emptyTitle="No software"
        emptyDescription="Add a program or firmware project to the library."
        renderInfo={(software) => <SoftwareInfo software={software} />}
        onUpdate={editSoftware}
        onDelete={deleteSoftware}
        actions={[
          { key: "open-source", label: "Open Source", onSelect: openSource },
          { key: "flash", label: "Flash Program", onSelect: openFlash },
        ]}
      />}
    </Card>

    <Dialog
      open={editorId !== undefined}
      title={editorId === null ? "Add Software" : "Update Software"}
      closeLabel="Close"
      onClose={() => setEditorId(undefined)}
    >
      <form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); void saveSoftware(); }}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name"><Input required maxLength={200} value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} /></Field>
          <Field label="Version"><Input required maxLength={100} value={draft.version} placeholder="e.g. 1.0.0" onChange={(event) => setDraft((current) => ({ ...current, version: event.target.value }))} /></Field>
        </div>
        <Field label="Description"><Textarea maxLength={4000} value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} /></Field>
        <Field label="Supported Device" hint="Use the chip or board name, for example XIAO ESP32S3.">
          <Input required maxLength={200} value={draft.supported_device} placeholder="XIAO ESP32S3" onChange={(event) => setDraft((current) => ({ ...current, supported_device: event.target.value }))} />
        </Field>
        <Field label="Source Code Address" hint="Use an HTTP(S) URL to open a repository, or a local sketch folder/.ino path to open and flash it.">
          <Input required maxLength={2000} value={draft.source_code_addr} placeholder="/path/to/sketch or https://github.com/..." onChange={(event) => setDraft((current) => ({ ...current, source_code_addr: event.target.value }))} />
        </Field>
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setEditorId(undefined)}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save Software"}</Button></div>
      </form>
    </Dialog>

    <Dialog
      open={flashRecord !== null}
      title={flashRecord ? `Flash ${flashRecord.name} ${flashRecord.version}` : "Flash Program"}
      closeLabel="Close"
      onClose={() => { if (!flashing) setFlashRecord(null); }}
    >
      <div className="grid gap-4">
        <Alert tone="warning">Flashing overwrites the program currently installed on the selected inventory board. Supported device: {flashRecord?.supported_device}. Build target: {flashFqbn || "XIAO ESP32S3"}.</Alert>
        <InfoRow label="Source"><span className="font-mono text-xs">{flashRecord?.source_code_addr}</span></InfoRow>
        {!cliAvailable ? <Alert tone="danger">arduino-cli was not found. Install Arduino CLI and the esp32:esp32 core before flashing.</Alert> : null}
        <Field label="USB Port">
          <Select value={selectedPort} disabled={portLoading || flashing} onChange={(event) => setSelectedPort(event.target.value)}>
            <option value="">{portLoading ? "Scanning USB ports…" : "Select a USB port…"}</option>
            {ports.map((port) => <option key={port.device} value={port.device} disabled={port.reserved_by_experiment}>{port.device} · {port.product || port.manufacturer || "USB serial device"}{port.reserved_by_experiment ? " · Used by experiment rig" : ""}</option>)}
          </Select>
        </Field>
        {flashJob ? <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-100">
          <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3"><div><p className="text-sm font-semibold">Background Flash Activity</p><p className="mt-1 text-xs text-zinc-400">{flashJob.message}</p></div><Badge tone={flashJob.status === "completed" ? "success" : flashJob.status === "failed" ? "danger" : "warning"}>{flashJob.status.toUpperCase()}</Badge></div>
          <div className="max-h-64 overflow-auto p-4 font-mono text-xs leading-5">{flashJob.logs.map((log, index) => <p key={`${log.timestamp}-${index}`}><span className="text-zinc-500">[{log.timestamp.slice(11)}]</span> {log.message}</p>)}</div>
        </div> : null}
        <div className="flex justify-end gap-2"><Button variant="secondary" disabled={flashing} onClick={() => setFlashRecord(null)}>Cancel</Button><Button disabled={!selectedPort || !cliAvailable || flashing || portLoading} onClick={() => void startFlash()}><BoltIcon className="size-4" />{flashing ? "Flashing…" : "Flash Program"}</Button></div>
      </div>
    </Dialog>
  </div>;
}
