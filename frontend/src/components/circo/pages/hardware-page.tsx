"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowPathIcon, PlusIcon } from "@heroicons/react/20/solid";
import type { Board, HardwareStatus, Peripheral } from "@/app/types";
import { api } from "@/app/lib";
import { PageHeader, SectionHeader } from "@/components/circo/page-elements";
import { Alert, Badge, Button, Card, Dialog, EmptyState, Field, Input, Select } from "@/components/circo/ui";
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
      setMessage({ kind: "danger", text: error instanceof Error ? error.message : "硬件数据加载失败" });
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
    if (!window.confirm(`删除主板“${board.model} · ${board.mac}”？`)) return;
    try { await api(`/boards/${board.board_id}`, { method: "DELETE" }); await loadHardware(); }
    catch (error) { setMessage({ kind: "danger", text: error instanceof Error ? error.message : "主板删除失败" }); }
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
        text: onlineCount > 0 ? `局域网扫描完成：发现 ${onlineCount} 块在线库存主板。` : "局域网扫描完成：未发现在线库存主板。",
      });
    } catch (error) {
      setMessage({ kind: "danger", text: error instanceof Error ? error.message : "局域网主板扫描失败" });
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
    <PageHeader eyebrow="资源" title="硬件" subtitle="管理库存主板与连接到主板的外接设备。" />
    {message && <Alert tone={message.kind}>{message.text}</Alert>}

    <Card>
      <SectionHeader title="主板" subtitle={`${boards.length} 块主板`} action={<div className="flex flex-wrap gap-2"><Button variant="secondary" disabled={refreshingBoards} onClick={() => void refreshOnlineBoards()}><ArrowPathIcon className={`size-4 ${refreshingBoards ? "animate-spin" : ""}`} />{refreshingBoards ? "扫描中…" : "刷新在线状态"}</Button><Button onClick={openNewBoard}><PlusIcon className="size-4" />插入新主板</Button></div>} />
      {loading ? <p className="py-10 text-center text-sm text-zinc-500">加载中…</p> : boards.length === 0 ? <EmptyState title="暂无主板" description="插入主板并完成体检后，设备会自动加入库存。" action={<Button onClick={openNewBoard}>插入新主板</Button>} /> : <div className="table-wrap"><table><thead><tr><th>ID</th><th>型号</th><th>MAC</th><th>状态</th><th>体检结果</th><th>外设</th><th>创建/更新</th><th>操作</th></tr></thead><tbody>{boards.map((board) => <tr key={board.board_id}><td>{board.board_id}</td><td><strong>{board.model}</strong></td><td className="font-mono text-xs">{board.mac}</td><td><StatusBadge value={board.status} /></td><td className="min-w-64 text-xs"><div className="grid grid-cols-2 gap-x-3 gap-y-1"><span>USB：<HealthValue value={board.health_usb_detected} /></span><span>Hello：<HealthValue value={board.health_hello} /></span><span>Wi-Fi：<HealthValue value={board.health_wifi} /></span><span>Bluetooth：<HealthValue value={board.health_bluetooth} /></span><span>GPIO：<HealthValue value={board.health_gpio} /></span><span>PWM：<HealthValue value={board.health_pwm} /></span><span>UART：<HealthValue value={board.health_uart} /></span><span>SPI：<HealthValue value={board.health_spi} /></span></div>{board.health_checked_at && <p className="mt-2 text-zinc-400">{dateTime(board.health_checked_at)}</p>}</td><td>{board.peripheral_count}</td><td className="whitespace-nowrap text-xs text-zinc-500">{dateTime(board.created_at)}<br />{dateTime(board.updated_at)}</td><td className="whitespace-nowrap">{board.status === "online" && <><button type="button" onClick={() => onOpenConsole(board)}>控制台</button>{" "}</>}<button type="button" onClick={() => setHealthBoard(board)}>体检</button> <button type="button" className="row-delete" onClick={() => void removeBoard(board)}>删除</button></td></tr>)}</tbody></table></div>}
    </Card>

    <Card>
      <SectionHeader title="外接设备" subtitle={`${peripherals.length} 个设备`} action={<Button onClick={openNewPeripheral} disabled={boards.length === 0}><PlusIcon className="size-4" />新增外设</Button>} />
      {loading ? <p className="py-10 text-center text-sm text-zinc-500">加载中…</p> : peripherals.length === 0 ? <EmptyState title="暂无外接设备" description={boards.length ? "将摄像头、传感器或执行器添加到主板。" : "创建主板后才能添加外接设备。"} /> : <div className="table-wrap"><table><thead><tr><th>ID</th><th>名称</th><th>类型</th><th>型号</th><th>所属主板</th><th>接口</th><th>电压</th><th>状态</th><th>创建/更新</th><th>操作</th></tr></thead><tbody>{peripherals.map((peripheral) => <tr key={peripheral.peripheral_id}><td>{peripheral.peripheral_id}</td><td><strong>{peripheral.name}</strong></td><td>{peripheral.type.toUpperCase()}</td><td>{peripheral.model}</td><td>{peripheral.board_name}</td><td>{peripheral.interface_type}</td><td>{peripheral.voltage} V</td><td><StatusBadge value={peripheral.status} /></td><td className="whitespace-nowrap text-xs text-zinc-500">{dateTime(peripheral.created_at)}<br />{dateTime(peripheral.updated_at)}</td><td className="whitespace-nowrap"><button type="button" onClick={() => editPeripheral(peripheral)}>编辑</button> <button type="button" className="row-delete" onClick={() => void removePeripheral(peripheral)}>删除</button></td></tr>)}</tbody></table></div>}
    </Card>

    <Dialog open={insertPromptOpen} title="插入新主板" closeLabel="关闭" onClose={() => setInsertPromptOpen(false)}>
      <div className="grid gap-5"><Alert tone="warning">请使用 USB 数据线将待入库的 XIAO ESP32S3 连接到电脑。体检可能烧录库存诊断固件并覆盖板上原程序。</Alert><div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm leading-6 text-zinc-600"><p>无需手动填写表格。体检将自动读取型号和硬件 MAC，并记录 USB、Wi-Fi、Bluetooth、Hello World 及接口测试结果。</p></div><div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setInsertPromptOpen(false)}>取消</Button><Button onClick={() => { setInsertPromptOpen(false); setNewBoardHealthOpen(true); }}>已插入，进入体检</Button></div></div>
    </Dialog>

    <Dialog open={peripheralEditorId !== undefined} title={peripheralEditorId === null ? "新增外接设备" : "编辑外接设备"} closeLabel="关闭" onClose={() => setPeripheralEditorId(undefined)}>
      <form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); void savePeripheral(); }}>
        <div className="grid gap-4 sm:grid-cols-2"><Field label="名称"><Input required value={peripheralDraft.name} onChange={(event) => setPeripheralDraft((value) => ({ ...value, name: event.target.value }))} /></Field><Field label="型号"><Input required value={peripheralDraft.model} onChange={(event) => setPeripheralDraft((value) => ({ ...value, model: event.target.value }))} /></Field></div>
        <div className="grid gap-4 sm:grid-cols-2"><Field label="类型"><Select value={peripheralDraft.type} onChange={(event) => setPeripheralDraft((value) => ({ ...value, type: event.target.value as Peripheral['type'] }))}>{['camera', 'imu', 'dac', 'motor', 'sensor'].map((value) => <option value={value} key={value}>{value.toUpperCase()}</option>)}</Select></Field><Field label="所属主板"><Select required value={peripheralDraft.board_id} onChange={(event) => setPeripheralDraft((value) => ({ ...value, board_id: event.target.value }))}><option value="">选择主板…</option>{boards.map((board) => <option value={board.board_id} key={board.board_id}>{board.model} · {board.mac}</option>)}</Select></Field></div>
        <div className="grid gap-4 sm:grid-cols-3"><Field label="接口类型"><Select value={peripheralDraft.interface_type} onChange={(event) => setPeripheralDraft((value) => ({ ...value, interface_type: event.target.value as Peripheral['interface_type'] }))}>{['GPIO', 'I2C', 'SPI', 'UART', 'PWM'].map((value) => <option value={value} key={value}>{value}</option>)}</Select></Field><Field label="电压 (V)"><Input required min="0" step="any" type="number" value={peripheralDraft.voltage} onChange={(event) => setPeripheralDraft((value) => ({ ...value, voltage: event.target.value }))} /></Field><Field label="状态"><Select value={peripheralDraft.status} onChange={(event) => setPeripheralDraft((value) => ({ ...value, status: event.target.value as HardwareStatus }))}><option value="online">Online</option><option value="offline">Offline</option><option value="broken">Broken</option></Select></Field></div>
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setPeripheralEditorId(undefined)}>取消</Button><Button type="submit" disabled={saving}>{saving ? "保存中…" : "保存"}</Button></div>
      </form>
    </Dialog>
    <HardwareHealthDialog board={healthBoard} creating={newBoardHealthOpen} onClose={() => { setHealthBoard(null); setNewBoardHealthOpen(false); }} onCompleted={(updated) => { setBoards((current) => current.some((board) => board.board_id === updated.board_id) ? current.map((board) => board.board_id === updated.board_id ? updated : board) : [...current, updated]); setHealthBoard(null); setNewBoardHealthOpen(false); setMessage({ kind: "success", text: "体检完成，主板参数已自动写入库存。" }); }} />
  </div>;
}
