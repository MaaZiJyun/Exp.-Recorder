"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ArrowPathIcon, PlusIcon } from "@heroicons/react/20/solid";
import type { Board, HardwareStatus, Peripheral } from "@/app/types";
import { api } from "@/app/lib";
import { DataTable, type DataTableColumn } from "@/components/circo/data-table";
import { PageHeader, SectionHeader } from "@/components/circo/page-elements";
import { Alert, Badge, Button, Card, Dialog, Field, Input, Select } from "@/components/circo/primitives";
import { HardwareHealthDialog } from "@/components/circo/pages/hardware-health-dialog";

type PeripheralDraft = {
  name: string;
  type: Peripheral["type"];
  model: string;
  board_id: string;
  interface_type: Peripheral["interface_type"];
  voltage: string;
  status: HardwareStatus;
};

type BoardDiscoveryResponse = {
  boards: Board[];
  online_board_ids: number[];
  discovered: Array<{ mac: string; ip_address: string; source: string }>;
  scanned_at: string;
};

const emptyPeripheral: PeripheralDraft = { name: "", type: "sensor", model: "", board_id: "", interface_type: "GPIO", voltage: "3.3", status: "offline" };

function StatusBadge({ value }: { value: HardwareStatus }) {
  return <Badge tone={value === "online" ? "success" : value === "broken" ? "danger" : "neutral"}>{value.toUpperCase()}</Badge>;
}

function HealthValue({ value }: { value: boolean | null }) {
  if (value === null) return <span className="text-zinc-400">—</span>;
  return <span className={value ? "text-green-700" : "text-red-700"}>{value ? "True" : "False"}</span>;
}

function dateTime(value: string) {
  return new Date(value.includes("T") ? value : `${value.replace(" ", "T")}Z`).toLocaleString();
}

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return <div className="flex items-start justify-between gap-4 border-b border-zinc-200/70 py-2 last:border-0 dark:border-zinc-800"><dt className="text-zinc-500">{label}</dt><dd className="min-w-0 break-words text-right font-medium text-zinc-900 dark:text-zinc-100">{children}</dd></div>;
}

const boardColumns: DataTableColumn<Board>[] = [
  { key: "id", header: "ID", cell: (board) => board.board_id, searchValue: (board) => board.board_id },
  { key: "model", header: "Model", cell: (board) => <strong>{board.model}</strong>, searchValue: (board) => board.model },
  { key: "mac", header: "MAC", cell: (board) => <span className="font-mono text-xs">{board.mac}</span>, searchValue: (board) => board.mac },
  { key: "status", header: "Status", cell: (board) => <StatusBadge value={board.status} />, searchValue: (board) => board.status },
  { key: "peripherals", header: "Peripherals", cell: (board) => board.peripheral_count, searchValue: (board) => board.peripheral_count },
  { key: "updated", header: "Updated", cell: (board) => <span className="text-xs text-zinc-500">{dateTime(board.updated_at)}</span>, searchValue: (board) => board.updated_at },
];

const peripheralColumns: DataTableColumn<Peripheral>[] = [
  { key: "id", header: "ID", cell: (peripheral) => peripheral.peripheral_id, searchValue: (peripheral) => peripheral.peripheral_id },
  { key: "name", header: "Name", cell: (peripheral) => <strong>{peripheral.name}</strong>, searchValue: (peripheral) => peripheral.name },
  { key: "type", header: "Type", cell: (peripheral) => peripheral.type.toUpperCase(), searchValue: (peripheral) => peripheral.type },
  { key: "model", header: "Model", cell: (peripheral) => peripheral.model, searchValue: (peripheral) => peripheral.model },
  { key: "board", header: "Board", cell: (peripheral) => peripheral.board_name, searchValue: (peripheral) => peripheral.board_name },
  { key: "interface", header: "Interface", cell: (peripheral) => peripheral.interface_type, searchValue: (peripheral) => peripheral.interface_type },
  { key: "status", header: "Status", cell: (peripheral) => <StatusBadge value={peripheral.status} />, searchValue: (peripheral) => peripheral.status },
];

function BoardInfo({ board }: { board: Board }) {
  return <dl>
    <InfoRow label="ID">{board.board_id}</InfoRow>
    <InfoRow label="Model">{board.model}</InfoRow>
    <InfoRow label="MAC"><span className="font-mono text-xs">{board.mac}</span></InfoRow>
    <InfoRow label="Status"><StatusBadge value={board.status} /></InfoRow>
    <InfoRow label="Peripherals">{board.peripheral_count}</InfoRow>
    <InfoRow label="USB"><HealthValue value={board.health_usb_detected} /></InfoRow>
    <InfoRow label="Hello World"><HealthValue value={board.health_hello} /></InfoRow>
    <InfoRow label="Wi-Fi"><HealthValue value={board.health_wifi} /></InfoRow>
    <InfoRow label="Bluetooth"><HealthValue value={board.health_bluetooth} /></InfoRow>
    <InfoRow label="GPIO"><HealthValue value={board.health_gpio} /></InfoRow>
    <InfoRow label="PWM"><HealthValue value={board.health_pwm} /></InfoRow>
    <InfoRow label="UART"><HealthValue value={board.health_uart} /></InfoRow>
    <InfoRow label="SPI"><HealthValue value={board.health_spi} /></InfoRow>
    {board.health_checked_at ? <InfoRow label="Health Checked">{dateTime(board.health_checked_at)}</InfoRow> : null}
    <InfoRow label="Created">{dateTime(board.created_at)}</InfoRow>
    <InfoRow label="Updated">{dateTime(board.updated_at)}</InfoRow>
  </dl>;
}

function PeripheralInfo({ peripheral }: { peripheral: Peripheral }) {
  return <dl>
    <InfoRow label="ID">{peripheral.peripheral_id}</InfoRow>
    <InfoRow label="Name">{peripheral.name}</InfoRow>
    <InfoRow label="Type">{peripheral.type.toUpperCase()}</InfoRow>
    <InfoRow label="Model">{peripheral.model}</InfoRow>
    <InfoRow label="Board">{peripheral.board_name}</InfoRow>
    <InfoRow label="Interface">{peripheral.interface_type}</InfoRow>
    <InfoRow label="Voltage">{peripheral.voltage} V</InfoRow>
    <InfoRow label="Status"><StatusBadge value={peripheral.status} /></InfoRow>
    <InfoRow label="Created">{dateTime(peripheral.created_at)}</InfoRow>
    <InfoRow label="Updated">{dateTime(peripheral.updated_at)}</InfoRow>
  </dl>;
}

export function HardwarePage({ onOpenConsole }: { onOpenConsole: (board: Board) => void }) {
  const [boards, setBoards] = useState<Board[]>([]);
  const [peripherals, setPeripherals] = useState<Peripheral[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshingBoards, setRefreshingBoards] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "danger"; text: string } | null>(null);
  const [insertPromptOpen, setInsertPromptOpen] = useState(false);
  const [newBoardHealthOpen, setNewBoardHealthOpen] = useState(false);
  const [peripheralEditorId, setPeripheralEditorId] = useState<number | null | undefined>(undefined);
  const [peripheralDraft, setPeripheralDraft] = useState<PeripheralDraft>(emptyPeripheral);
  const [healthBoard, setHealthBoard] = useState<Board | null>(null);

  const loadHardware = useCallback(async () => {
    setLoading(true);
    try {
      const [boardRecords, peripheralRecords] = await Promise.all([
        api<Board[]>("/boards"),
        api<Peripheral[]>("/peripherals"),
      ]);
      setBoards(boardRecords);
      setPeripherals(peripheralRecords);
    } catch (error) {
      setMessage({ kind: "danger", text: error instanceof Error ? error.message : "Failed to load hardware data" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadHardware(), 0);
    return () => window.clearTimeout(timer);
  }, [loadHardware]);

  const openNewBoard = () => setInsertPromptOpen(true);
  const removeBoard = async (board: Board) => {
    if (!window.confirm(`Delete board “${board.model} · ${board.mac}”?`)) return;
    try { await api(`/boards/${board.board_id}`, { method: "DELETE" }); await loadHardware(); }
    catch (error) { setMessage({ kind: "danger", text: error instanceof Error ? error.message : "Failed to delete board" }); }
  };

  const refreshOnlineBoards = async () => {
    setRefreshingBoards(true);
    setMessage(null);
    try {
      const response = await api<BoardDiscoveryResponse>("/boards/discover", { method: "POST" });
      setBoards(response.boards);
      const onlineCount = response.online_board_ids.length;
      setMessage({
        kind: "success",
        text: onlineCount > 0 ? `LAN scan complete: found ${onlineCount} online inventory board${onlineCount === 1 ? "" : "s"}.` : "LAN scan complete: no online inventory boards found.",
      });
    } catch (error) {
      setMessage({ kind: "danger", text: error instanceof Error ? error.message : "LAN board scan failed" });
    } finally {
      setRefreshingBoards(false);
    }
  };

  const openNewPeripheral = () => { setPeripheralDraft({ ...emptyPeripheral, board_id: boards[0] ? String(boards[0].board_id) : "" }); setPeripheralEditorId(null); };
  const editPeripheral = (peripheral: Peripheral) => {
    setPeripheralDraft({ name: peripheral.name, type: peripheral.type, model: peripheral.model, board_id: String(peripheral.board_id), interface_type: peripheral.interface_type, voltage: String(peripheral.voltage), status: peripheral.status });
    setPeripheralEditorId(peripheral.peripheral_id);
  };
  const savePeripheral = async () => {
    setSaving(true); setMessage(null);
    try {
      await api(peripheralEditorId === null ? "/peripherals" : `/peripherals/${peripheralEditorId}`, { method: peripheralEditorId === null ? "POST" : "PUT", body: JSON.stringify({ ...peripheralDraft, board_id: Number(peripheralDraft.board_id), voltage: Number(peripheralDraft.voltage) }) });
      setPeripheralEditorId(undefined);
      setMessage({ kind: "success", text: peripheralEditorId === null ? "Peripheral created." : "Peripheral updated." });
      await loadHardware();
    } catch (error) { setMessage({ kind: "danger", text: error instanceof Error ? error.message : "Failed to save peripheral" }); }
    finally { setSaving(false); }
  };
  const removePeripheral = async (peripheral: Peripheral) => {
    if (!window.confirm(`Delete peripheral “${peripheral.name}”?`)) return;
    try { await api(`/peripherals/${peripheral.peripheral_id}`, { method: "DELETE" }); await loadHardware(); }
    catch (error) { setMessage({ kind: "danger", text: error instanceof Error ? error.message : "Failed to delete peripheral" }); }
  };

  return <div className="grid gap-8">
    <PageHeader eyebrow="Resources" title="Hardware" subtitle="Manage inventory boards and their connected peripherals." />
    {message && <Alert tone={message.kind}>{message.text}</Alert>}

    <Card>
      <SectionHeader title="Boards" subtitle={`${boards.length} board${boards.length === 1 ? "" : "s"}`} action={<div className="flex flex-wrap gap-2"><Button variant="secondary" disabled={refreshingBoards} onClick={() => void refreshOnlineBoards()}><ArrowPathIcon className={`size-4 ${refreshingBoards ? "animate-spin" : ""}`} />{refreshingBoards ? "Scanning…" : "Refresh Online Status"}</Button><Button onClick={openNewBoard}><PlusIcon className="size-4" />Insert New Board</Button></div>} />
      {loading ? <p className="py-10 text-center text-sm text-zinc-500">Loading…</p> : <DataTable
        rows={boards}
        columns={boardColumns}
        getRowId={(board) => board.board_id}
        getInfoTitle={(board) => board.model}
        getSearchText={(board) => `${board.board_id} ${board.model} ${board.mac} ${board.status}`}
        searchPlaceholder="Search boards by model, MAC, status, or ID..."
        emptyTitle="No boards"
        emptyDescription="Insert a board and complete its health check to add it to inventory automatically."
        renderInfo={(board) => <BoardInfo board={board} />}
        onUpdate={(board) => setHealthBoard(board)}
        onDelete={removeBoard}
        actions={[{ key: "console", label: "Console", onSelect: onOpenConsole, hidden: (board) => board.status !== "online" }]}
      />}
    </Card>

    <Card>
      <SectionHeader title="Peripherals" subtitle={`${peripherals.length} device${peripherals.length === 1 ? "" : "s"}`} action={<Button onClick={openNewPeripheral} disabled={boards.length === 0}><PlusIcon className="size-4" />Add Peripheral</Button>} />
      {loading ? <p className="py-10 text-center text-sm text-zinc-500">Loading…</p> : <DataTable
        rows={peripherals}
        columns={peripheralColumns}
        getRowId={(peripheral) => peripheral.peripheral_id}
        getInfoTitle={(peripheral) => peripheral.name}
        getSearchText={(peripheral) => `${peripheral.peripheral_id} ${peripheral.name} ${peripheral.type} ${peripheral.model} ${peripheral.board_name} ${peripheral.interface_type} ${peripheral.status}`}
        searchPlaceholder="Search peripherals..."
        emptyTitle="No peripherals"
        emptyDescription={boards.length ? "Add a camera, sensor, or actuator to a board." : "Create a board before adding peripherals."}
        renderInfo={(peripheral) => <PeripheralInfo peripheral={peripheral} />}
        onUpdate={editPeripheral}
        onDelete={removePeripheral}
      />}
    </Card>

    <Dialog open={insertPromptOpen} title="Insert New Board" closeLabel="Close" onClose={() => setInsertPromptOpen(false)}>
      <div className="grid gap-5"><Alert tone="warning">Connect the inventory XIAO ESP32S3 to this computer with a USB data cable. The health check may flash inventory diagnostic firmware and overwrite the existing program.</Alert><div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm leading-6 text-zinc-600"><p>No manual form is required. The health check reads the model and hardware MAC automatically, then records USB, Wi-Fi, Bluetooth, Hello World, and interface-test results.</p></div><div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setInsertPromptOpen(false)}>Cancel</Button><Button onClick={() => { setInsertPromptOpen(false); setNewBoardHealthOpen(true); }}>Board Connected — Start Check</Button></div></div>
    </Dialog>

    <Dialog open={peripheralEditorId !== undefined} title={peripheralEditorId === null ? "Add Peripheral" : "Edit Peripheral"} closeLabel="Close" onClose={() => setPeripheralEditorId(undefined)}>
      <form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); void savePeripheral(); }}>
        <div className="grid gap-4 sm:grid-cols-2"><Field label="Name"><Input required value={peripheralDraft.name} onChange={(event) => setPeripheralDraft((value) => ({ ...value, name: event.target.value }))} /></Field><Field label="Model"><Input required value={peripheralDraft.model} onChange={(event) => setPeripheralDraft((value) => ({ ...value, model: event.target.value }))} /></Field></div>
        <div className="grid gap-4 sm:grid-cols-2"><Field label="Type"><Select value={peripheralDraft.type} onChange={(event) => setPeripheralDraft((value) => ({ ...value, type: event.target.value as Peripheral['type'] }))}>{['camera', 'imu', 'dac', 'motor', 'sensor'].map((value) => <option value={value} key={value}>{value.toUpperCase()}</option>)}</Select></Field><Field label="Board"><Select required value={peripheralDraft.board_id} onChange={(event) => setPeripheralDraft((value) => ({ ...value, board_id: event.target.value }))}><option value="">Select a board…</option>{boards.map((board) => <option value={board.board_id} key={board.board_id}>{board.model} · {board.mac}</option>)}</Select></Field></div>
        <div className="grid gap-4 sm:grid-cols-3"><Field label="Interface Type"><Select value={peripheralDraft.interface_type} onChange={(event) => setPeripheralDraft((value) => ({ ...value, interface_type: event.target.value as Peripheral['interface_type'] }))}>{['GPIO', 'I2C', 'SPI', 'UART', 'PWM'].map((value) => <option value={value} key={value}>{value}</option>)}</Select></Field><Field label="Voltage (V)"><Input required min="0" step="any" type="number" value={peripheralDraft.voltage} onChange={(event) => setPeripheralDraft((value) => ({ ...value, voltage: event.target.value }))} /></Field><Field label="Status"><Select value={peripheralDraft.status} onChange={(event) => setPeripheralDraft((value) => ({ ...value, status: event.target.value as HardwareStatus }))}><option value="online">Online</option><option value="offline">Offline</option><option value="broken">Broken</option></Select></Field></div>
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setPeripheralEditorId(undefined)}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</Button></div>
      </form>
    </Dialog>
    <HardwareHealthDialog board={healthBoard} creating={newBoardHealthOpen} onClose={() => { setHealthBoard(null); setNewBoardHealthOpen(false); }} onCompleted={(updated) => { setBoards((current) => current.some((board) => board.board_id === updated.board_id) ? current.map((board) => board.board_id === updated.board_id ? updated : board) : [...current, updated]); setHealthBoard(null); setNewBoardHealthOpen(false); setMessage({ kind: "success", text: "Health check complete. Board details were added to inventory automatically." }); }} />
  </div>;
}
