"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowPathIcon, PlusIcon } from "@heroicons/react/20/solid";
import type { Board, HardwareStatus, Peripheral } from "@/app/types";
import { api } from "@/app/lib";
import { PageHeader, SectionHeader } from "@/components/circo/page-elements";
import { Alert, Badge, Button, Card, Dialog, EmptyState, Field, Input, Select } from "@/components/circo/primitives";
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
      {loading ? <p className="py-10 text-center text-sm text-zinc-500">Loading…</p> : boards.length === 0 ? <EmptyState title="No boards" description="Insert a board and complete its health check to add it to inventory automatically." action={<Button onClick={openNewBoard}>Insert New Board</Button>} /> : <div className="table-wrap"><table><thead><tr><th>ID</th><th>MODEL</th><th>MAC</th><th>STATUS</th><th>HEALTH CHECK</th><th>PERIPHERALS</th><th>CREATED / UPDATED</th><th>ACTIONS</th></tr></thead><tbody>{boards.map((board) => <tr key={board.board_id}><td>{board.board_id}</td><td><strong>{board.model}</strong></td><td className="font-mono text-xs">{board.mac}</td><td><StatusBadge value={board.status} /></td><td className="min-w-64 text-xs"><div className="grid grid-cols-2 gap-x-3 gap-y-1"><span>USB: <HealthValue value={board.health_usb_detected} /></span><span>Hello: <HealthValue value={board.health_hello} /></span><span>Wi-Fi: <HealthValue value={board.health_wifi} /></span><span>Bluetooth: <HealthValue value={board.health_bluetooth} /></span><span>GPIO: <HealthValue value={board.health_gpio} /></span><span>PWM: <HealthValue value={board.health_pwm} /></span><span>UART: <HealthValue value={board.health_uart} /></span><span>SPI: <HealthValue value={board.health_spi} /></span></div>{board.health_checked_at && <p className="mt-2 text-zinc-400">{dateTime(board.health_checked_at)}</p>}</td><td>{board.peripheral_count}</td><td className="whitespace-nowrap text-xs text-zinc-500">{dateTime(board.created_at)}<br />{dateTime(board.updated_at)}</td><td className="whitespace-nowrap">{board.status === "online" && <><button type="button" onClick={() => onOpenConsole(board)}>Console</button>{" "}</>}<button type="button" onClick={() => setHealthBoard(board)}>Health Check</button> <button type="button" className="row-delete" onClick={() => void removeBoard(board)}>Delete</button></td></tr>)}</tbody></table></div>}
    </Card>

    <Card>
      <SectionHeader title="Peripherals" subtitle={`${peripherals.length} device${peripherals.length === 1 ? "" : "s"}`} action={<Button onClick={openNewPeripheral} disabled={boards.length === 0}><PlusIcon className="size-4" />Add Peripheral</Button>} />
      {loading ? <p className="py-10 text-center text-sm text-zinc-500">Loading…</p> : peripherals.length === 0 ? <EmptyState title="No peripherals" description={boards.length ? "Add a camera, sensor, or actuator to a board." : "Create a board before adding peripherals."} /> : <div className="table-wrap"><table><thead><tr><th>ID</th><th>NAME</th><th>TYPE</th><th>MODEL</th><th>BOARD</th><th>INTERFACE</th><th>VOLTAGE</th><th>STATUS</th><th>CREATED / UPDATED</th><th>ACTIONS</th></tr></thead><tbody>{peripherals.map((peripheral) => <tr key={peripheral.peripheral_id}><td>{peripheral.peripheral_id}</td><td><strong>{peripheral.name}</strong></td><td>{peripheral.type.toUpperCase()}</td><td>{peripheral.model}</td><td>{peripheral.board_name}</td><td>{peripheral.interface_type}</td><td>{peripheral.voltage} V</td><td><StatusBadge value={peripheral.status} /></td><td className="whitespace-nowrap text-xs text-zinc-500">{dateTime(peripheral.created_at)}<br />{dateTime(peripheral.updated_at)}</td><td className="whitespace-nowrap"><button type="button" onClick={() => editPeripheral(peripheral)}>Edit</button> <button type="button" className="row-delete" onClick={() => void removePeripheral(peripheral)}>Delete</button></td></tr>)}</tbody></table></div>}
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
