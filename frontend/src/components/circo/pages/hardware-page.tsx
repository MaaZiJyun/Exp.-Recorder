"use client";

import { useCallback, useEffect, useState } from "react";
import { PlusIcon } from "@heroicons/react/20/solid";
import type { Board, HardwareStatus, Peripheral } from "@/app/types";
import { api } from "@/app/lib";
import { PageHeader, SectionHeader } from "@/components/circo/page-elements";
import { Alert, Badge, Button, Card, Dialog, EmptyState, Field, Input, Select } from "@/components/circo/ui";

type BoardDraft = {
  name: string;
  model: string;
  serial_number: string;
  wifi: boolean;
  bluetooth: boolean;
  usb: boolean;
  gpio_count: string;
  working_voltage: string;
  status: HardwareStatus;
};

type PeripheralDraft = {
  name: string;
  type: Peripheral["type"];
  model: string;
  board_id: string;
  interface_type: Peripheral["interface_type"];
  voltage: string;
  status: HardwareStatus;
};

const emptyBoard: BoardDraft = { name: "", model: "", serial_number: "", wifi: false, bluetooth: false, usb: false, gpio_count: "0", working_voltage: "3.3", status: "offline" };
const emptyPeripheral: PeripheralDraft = { name: "", type: "sensor", model: "", board_id: "", interface_type: "GPIO", voltage: "3.3", status: "offline" };

function StatusBadge({ value }: { value: HardwareStatus }) {
  return <Badge tone={value === "online" ? "success" : value === "broken" ? "danger" : "neutral"}>{value.toUpperCase()}</Badge>;
}

function dateTime(value: string) {
  return new Date(value.includes("T") ? value : `${value.replace(" ", "T")}Z`).toLocaleString();
}

export function HardwarePage() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [peripherals, setPeripherals] = useState<Peripheral[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "danger"; text: string } | null>(null);
  const [boardEditorId, setBoardEditorId] = useState<number | null | undefined>(undefined);
  const [peripheralEditorId, setPeripheralEditorId] = useState<number | null | undefined>(undefined);
  const [boardDraft, setBoardDraft] = useState<BoardDraft>(emptyBoard);
  const [peripheralDraft, setPeripheralDraft] = useState<PeripheralDraft>(emptyPeripheral);

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
      setMessage({ kind: "danger", text: error instanceof Error ? error.message : "硬件数据加载失败" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadHardware(), 0);
    return () => window.clearTimeout(timer);
  }, [loadHardware]);

  const openNewBoard = () => { setBoardDraft(emptyBoard); setBoardEditorId(null); };
  const editBoard = (board: Board) => {
    setBoardDraft({ name: board.name, model: board.model, serial_number: board.serial_number, wifi: Boolean(board.wifi), bluetooth: Boolean(board.bluetooth), usb: Boolean(board.usb), gpio_count: String(board.gpio_count), working_voltage: String(board.working_voltage), status: board.status });
    setBoardEditorId(board.board_id);
  };
  const saveBoard = async () => {
    setSaving(true); setMessage(null);
    try {
      await api(boardEditorId === null ? "/boards" : `/boards/${boardEditorId}`, { method: boardEditorId === null ? "POST" : "PUT", body: JSON.stringify({ ...boardDraft, gpio_count: Number(boardDraft.gpio_count), working_voltage: Number(boardDraft.working_voltage) }) });
      setBoardEditorId(undefined);
      setMessage({ kind: "success", text: boardEditorId === null ? "主板已创建。" : "主板已更新。" });
      await loadHardware();
    } catch (error) { setMessage({ kind: "danger", text: error instanceof Error ? error.message : "主板保存失败" }); }
    finally { setSaving(false); }
  };
  const removeBoard = async (board: Board) => {
    if (!window.confirm(`删除主板“${board.name}”？`)) return;
    try { await api(`/boards/${board.board_id}`, { method: "DELETE" }); await loadHardware(); }
    catch (error) { setMessage({ kind: "danger", text: error instanceof Error ? error.message : "主板删除失败" }); }
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
      setMessage({ kind: "success", text: peripheralEditorId === null ? "外接设备已创建。" : "外接设备已更新。" });
      await loadHardware();
    } catch (error) { setMessage({ kind: "danger", text: error instanceof Error ? error.message : "外接设备保存失败" }); }
    finally { setSaving(false); }
  };
  const removePeripheral = async (peripheral: Peripheral) => {
    if (!window.confirm(`删除外接设备“${peripheral.name}”？`)) return;
    try { await api(`/peripherals/${peripheral.peripheral_id}`, { method: "DELETE" }); await loadHardware(); }
    catch (error) { setMessage({ kind: "danger", text: error instanceof Error ? error.message : "外接设备删除失败" }); }
  };

  return <div className="grid gap-8">
    <PageHeader eyebrow="资源" title="硬件" subtitle="管理实验主板与连接到主板的外接设备。" />
    {message && <Alert tone={message.kind}>{message.text}</Alert>}

    <Card>
      <SectionHeader title="主板" subtitle={`${boards.length} 块主板`} action={<Button onClick={openNewBoard}><PlusIcon className="size-4" />新增主板</Button>} />
      {loading ? <p className="py-10 text-center text-sm text-zinc-500">加载中…</p> : boards.length === 0 ? <EmptyState title="暂无主板" description="先创建主板，再为其添加外接设备。" action={<Button onClick={openNewBoard}>新增主板</Button>} /> : <div className="table-wrap"><table><thead><tr><th>ID</th><th>名称</th><th>型号</th><th>Serial Number</th><th>连接能力</th><th>GPIO</th><th>工作电压</th><th>状态</th><th>外设</th><th>创建/更新</th><th>操作</th></tr></thead><tbody>{boards.map((board) => <tr key={board.board_id}><td>{board.board_id}</td><td><strong>{board.name}</strong></td><td>{board.model}</td><td className="font-mono text-xs">{board.serial_number}</td><td>{[board.wifi && "Wi-Fi", board.bluetooth && "Bluetooth", board.usb && "USB"].filter(Boolean).join(" / ") || "—"}</td><td>{board.gpio_count}</td><td>{board.working_voltage} V</td><td><StatusBadge value={board.status} /></td><td>{board.peripheral_count}</td><td className="whitespace-nowrap text-xs text-zinc-500">{dateTime(board.created_at)}<br />{dateTime(board.updated_at)}</td><td className="whitespace-nowrap"><button type="button" onClick={() => editBoard(board)}>编辑</button> <button type="button" className="row-delete" onClick={() => void removeBoard(board)}>删除</button></td></tr>)}</tbody></table></div>}
    </Card>

    <Card>
      <SectionHeader title="外接设备" subtitle={`${peripherals.length} 个设备`} action={<Button onClick={openNewPeripheral} disabled={boards.length === 0}><PlusIcon className="size-4" />新增外设</Button>} />
      {loading ? <p className="py-10 text-center text-sm text-zinc-500">加载中…</p> : peripherals.length === 0 ? <EmptyState title="暂无外接设备" description={boards.length ? "将摄像头、传感器或执行器添加到主板。" : "创建主板后才能添加外接设备。"} /> : <div className="table-wrap"><table><thead><tr><th>ID</th><th>名称</th><th>类型</th><th>型号</th><th>所属主板</th><th>接口</th><th>电压</th><th>状态</th><th>创建/更新</th><th>操作</th></tr></thead><tbody>{peripherals.map((peripheral) => <tr key={peripheral.peripheral_id}><td>{peripheral.peripheral_id}</td><td><strong>{peripheral.name}</strong></td><td>{peripheral.type.toUpperCase()}</td><td>{peripheral.model}</td><td>{peripheral.board_name}</td><td>{peripheral.interface_type}</td><td>{peripheral.voltage} V</td><td><StatusBadge value={peripheral.status} /></td><td className="whitespace-nowrap text-xs text-zinc-500">{dateTime(peripheral.created_at)}<br />{dateTime(peripheral.updated_at)}</td><td className="whitespace-nowrap"><button type="button" onClick={() => editPeripheral(peripheral)}>编辑</button> <button type="button" className="row-delete" onClick={() => void removePeripheral(peripheral)}>删除</button></td></tr>)}</tbody></table></div>}
    </Card>

    <Dialog open={boardEditorId !== undefined} title={boardEditorId === null ? "新增主板" : "编辑主板"} closeLabel="关闭" onClose={() => setBoardEditorId(undefined)}>
      <form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); void saveBoard(); }}>
        <div className="grid gap-4 sm:grid-cols-2"><Field label="名称"><Input required value={boardDraft.name} onChange={(event) => setBoardDraft((value) => ({ ...value, name: event.target.value }))} /></Field><Field label="型号"><Input required value={boardDraft.model} onChange={(event) => setBoardDraft((value) => ({ ...value, model: event.target.value }))} /></Field></div>
        <Field label="Serial Number"><Input required value={boardDraft.serial_number} onChange={(event) => setBoardDraft((value) => ({ ...value, serial_number: event.target.value }))} /></Field>
        <div className="grid gap-4 sm:grid-cols-3"><Field label="GPIO 数量"><Input required min="0" type="number" value={boardDraft.gpio_count} onChange={(event) => setBoardDraft((value) => ({ ...value, gpio_count: event.target.value }))} /></Field><Field label="工作电压 (V)"><Input required min="0" step="any" type="number" value={boardDraft.working_voltage} onChange={(event) => setBoardDraft((value) => ({ ...value, working_voltage: event.target.value }))} /></Field><Field label="状态"><Select value={boardDraft.status} onChange={(event) => setBoardDraft((value) => ({ ...value, status: event.target.value as HardwareStatus }))}><option value="online">Online</option><option value="offline">Offline</option><option value="broken">Broken</option></Select></Field></div>
        <fieldset className="flex flex-wrap gap-5 rounded-xl border border-zinc-200 p-4"><legend className="px-1 text-sm font-medium">连接能力</legend>{([['wifi', 'Wi-Fi'], ['bluetooth', 'Bluetooth'], ['usb', 'USB']] as const).map(([key, label]) => <label className="flex items-center gap-2 text-sm" key={key}><input type="checkbox" checked={boardDraft[key]} onChange={(event) => setBoardDraft((value) => ({ ...value, [key]: event.target.checked }))} />{label}</label>)}</fieldset>
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setBoardEditorId(undefined)}>取消</Button><Button type="submit" disabled={saving}>{saving ? "保存中…" : "保存"}</Button></div>
      </form>
    </Dialog>

    <Dialog open={peripheralEditorId !== undefined} title={peripheralEditorId === null ? "新增外接设备" : "编辑外接设备"} closeLabel="关闭" onClose={() => setPeripheralEditorId(undefined)}>
      <form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); void savePeripheral(); }}>
        <div className="grid gap-4 sm:grid-cols-2"><Field label="名称"><Input required value={peripheralDraft.name} onChange={(event) => setPeripheralDraft((value) => ({ ...value, name: event.target.value }))} /></Field><Field label="型号"><Input required value={peripheralDraft.model} onChange={(event) => setPeripheralDraft((value) => ({ ...value, model: event.target.value }))} /></Field></div>
        <div className="grid gap-4 sm:grid-cols-2"><Field label="类型"><Select value={peripheralDraft.type} onChange={(event) => setPeripheralDraft((value) => ({ ...value, type: event.target.value as Peripheral['type'] }))}>{['camera', 'imu', 'dac', 'motor', 'sensor'].map((value) => <option value={value} key={value}>{value.toUpperCase()}</option>)}</Select></Field><Field label="所属主板"><Select required value={peripheralDraft.board_id} onChange={(event) => setPeripheralDraft((value) => ({ ...value, board_id: event.target.value }))}><option value="">选择主板…</option>{boards.map((board) => <option value={board.board_id} key={board.board_id}>{board.name} · {board.model}</option>)}</Select></Field></div>
        <div className="grid gap-4 sm:grid-cols-3"><Field label="接口类型"><Select value={peripheralDraft.interface_type} onChange={(event) => setPeripheralDraft((value) => ({ ...value, interface_type: event.target.value as Peripheral['interface_type'] }))}>{['GPIO', 'I2C', 'SPI', 'UART', 'PWM'].map((value) => <option value={value} key={value}>{value}</option>)}</Select></Field><Field label="电压 (V)"><Input required min="0" step="any" type="number" value={peripheralDraft.voltage} onChange={(event) => setPeripheralDraft((value) => ({ ...value, voltage: event.target.value }))} /></Field><Field label="状态"><Select value={peripheralDraft.status} onChange={(event) => setPeripheralDraft((value) => ({ ...value, status: event.target.value as HardwareStatus }))}><option value="online">Online</option><option value="offline">Offline</option><option value="broken">Broken</option></Select></Field></div>
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setPeripheralEditorId(undefined)}>取消</Button><Button type="submit" disabled={saving}>{saving ? "保存中…" : "保存"}</Button></div>
      </form>
    </Dialog>
  </div>;
}
