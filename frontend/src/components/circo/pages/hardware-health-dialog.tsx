"use client";

import { useEffect, useState } from "react";
import type { Board, XiaoHealthJob, XiaoHealthResult, XiaoHealthSession, XiaoSerialPort } from "@/app/types";
import { api } from "@/app/lib";
import { Alert, Badge, Button, Card, Dialog, Field, Select } from "@/components/circo/ui";

type PortResponse = {
  ports: XiaoSerialPort[];
  arduino_cli_available: boolean;
};

function ResultBadge({ result }: { result?: XiaoHealthResult }) {
  if (!result) return <Badge>待检测</Badge>;
  if (result.skipped) return <Badge tone="info">已安装，跳过烧录</Badge>;
  return <Badge tone={result.passed ? "success" : "danger"}>{result.passed ? "通过" : "失败"}</Badge>;
}

function detailText(detail: XiaoHealthResult["detail"] | undefined) {
  if (!detail) return "";
  if (typeof detail === "string") return detail;
  const port = detail as Partial<XiaoSerialPort>;
  return [port.product, port.manufacturer, port.serial_number, port.device].filter(Boolean).join(" · ");
}

export function HardwareHealthDialog({ board, onClose, onCompleted }: { board: Board | null; onClose: () => void; onCompleted: (board: Board) => void }) {
  const [ports, setPorts] = useState<XiaoSerialPort[]>([]);
  const [selectedPort, setSelectedPort] = useState("");
  const [toolAvailable, setToolAvailable] = useState(true);
  const [loadingPorts, setLoadingPorts] = useState(false);
  const [running, setRunning] = useState(false);
  const [runningStep, setRunningStep] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [session, setSession] = useState<XiaoHealthSession | null>(null);
  const [healthJob, setHealthJob] = useState<XiaoHealthJob | null>(null);
  const [stepResults, setStepResults] = useState<Record<string, XiaoHealthResult>>({});
  const [skippedSteps, setSkippedSteps] = useState<Record<string, boolean>>({});
  const [peripheralResults, setPeripheralResults] = useState<Record<number, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!board) return;
    const timer = window.setTimeout(() => {
      setSession(null);
      setHealthJob(null);
      setStepResults({});
      setSkippedSteps({});
      setPeripheralResults({});
      setCompleting(false);
      setError(null);
      setLoadingPorts(true);
      void api<PortResponse>("/hardware-health/xiao/ports")
        .then((response) => {
          setPorts(response.ports);
          setToolAvailable(response.arduino_cli_available);
          const first = response.ports.find((port) => !port.reserved_by_experiment);
          setSelectedPort(first?.device ?? "");
        })
        .catch((reason) => setError(reason instanceof Error ? reason.message : "USB 设备扫描失败"))
        .finally(() => setLoadingPorts(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [board]);

  const start = async () => {
    if (!board || !selectedPort) return;
    setRunning(true);
    setError(null);
    setSession(null);
    setHealthJob(null);
    try {
      let job = await api<XiaoHealthJob>(`/boards/${board.board_id}/health/xiao/start`, { method: "POST", body: JSON.stringify({ port: selectedPort, flash: true }) });
      setHealthJob(job);
      while (job.status === "queued" || job.status === "running") {
        await new Promise((resolve) => window.setTimeout(resolve, 500));
        job = await api<XiaoHealthJob>(`/hardware-health/jobs/${job.job_id}`);
        setHealthJob(job);
      }
      if (job.status === "completed" && job.result) setSession(job.result);
      else throw new Error(job.message || "后台体检任务失败");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "体检启动失败");
    } finally {
      setRunning(false);
    }
  };

  const runStep = async (id: string) => {
    if (!board || !session) return;
    setRunningStep(id);
    setError(null);
    try {
      const response = await api<{ result: XiaoHealthResult }>(`/boards/${board.board_id}/health/xiao/test`, { method: "POST", body: JSON.stringify({ port: session.port, test: id }) });
      setStepResults((current) => ({ ...current, [id]: response.result }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "接口测试失败");
    } finally {
      setRunningStep(null);
    }
  };

  const initialPassed = Boolean(session?.checks.usb?.passed && session?.checks.flash?.passed && session?.checks.identity?.passed && session?.checks.hello?.passed);
  const requiredInterfaceIds = ["gpio", "pwm", "uart", "spi"] as const;
  const canComplete = Boolean(
    session?.checks.identity?.product
    && session.checks.identity.hardware_mac
    && requiredInterfaceIds.every((id) => stepResults[id] !== undefined),
  );

  const completeHealth = async () => {
    if (!board || !session || !canComplete) return;
    setCompleting(true);
    setError(null);
    try {
      const identity = session.checks.identity;
      const updated = await api<Board>(`/boards/${board.board_id}/health-result`, {
        method: "PUT",
        body: JSON.stringify({
          usb_detected: Boolean(session.checks.usb?.passed),
          mac: identity.hardware_mac,
          wifi: Boolean(identity.wifi),
          bluetooth: Boolean(identity.bluetooth),
          hello: Boolean(session.checks.hello?.passed),
          gpio: Boolean(stepResults.gpio?.passed),
          pwm: Boolean(stepResults.pwm?.passed),
          uart: Boolean(stepResults.uart?.passed),
          spi: Boolean(stepResults.spi?.passed),
        }),
      });
      onCompleted(updated);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "体检结果保存失败");
    } finally {
      setCompleting(false);
    }
  };

  return <Dialog open={board !== null} title={`板子体检${board ? ` · ${board.name}` : ""}`} closeLabel="关闭" onClose={onClose} size="wide">
    <div className="grid gap-6">
      <Alert tone="warning"><strong>库存诊断模式：</strong>体检会向所选库存板烧录专用固件，覆盖板上原有程序。实验台正在使用的 XIAO 串口会被锁定且不可选择。</Alert>
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="grid gap-4 rounded-xl border border-zinc-200 p-4 md:grid-cols-[1fr_2fr_auto] md:items-end">
        <Field label="体检类型"><Select value="xiao-esp32s3" disabled><option value="xiao-esp32s3">XIAO ESP32S3</option></Select></Field>
        <Field label="库存板 USB 端口"><Select value={selectedPort} disabled={loadingPorts || running} onChange={(event) => setSelectedPort(event.target.value)}><option value="">{loadingPorts ? "扫描中…" : "选择 USB 设备…"}</option>{ports.map((port) => <option key={port.device} value={port.device} disabled={port.reserved_by_experiment}>{port.device} · {port.product ?? "USB Serial"}{port.reserved_by_experiment ? "（实验台占用）" : ""}</option>)}</Select></Field>
        <Button onClick={() => void start()} disabled={!selectedPort || !toolAvailable || running}>{running ? "后台体检中…" : "检测固件并开始体检"}</Button>
      </div>
      {!toolAvailable && <Alert tone="danger">未找到 arduino-cli。请先安装 Arduino CLI 和 esp32:esp32 core。</Alert>}

      {healthJob && <section className="overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950 text-zinc-100">
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3"><div><p className="text-sm font-semibold">后台运行情况</p><p className="mt-1 text-xs text-zinc-400">{healthJob.message}</p></div><Badge tone={healthJob.status === "completed" ? "success" : healthJob.status === "failed" ? "danger" : "warning"}>{healthJob.status.toUpperCase()}</Badge></div>
        <div className="max-h-56 overflow-y-auto p-4 font-mono text-xs leading-6">{healthJob.logs.map((log, index) => <div className="grid grid-cols-[5rem_8rem_1fr] gap-3" key={`${log.timestamp}-${index}`}><time className="text-zinc-500">{log.timestamp.slice(11, 19)}</time><span className="text-cyan-400">{log.stage}</span><span className="break-all text-zinc-300">{log.message}</span></div>)}</div>
      </section>}

      {session && <>
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[['usb', 'USB 识别'], ['flash', '诊断固件'], ['identity', '芯片身份与无线能力'], ['hello', 'Hello World 程序']].map(([id, title]) => { const result = session.checks[id]; return <Card key={id} className="p-4"><div className="flex items-start justify-between gap-3"><h3 className="text-sm font-semibold">{title}</h3><ResultBadge result={result} /></div><p className="mt-3 break-all text-xs leading-5 text-zinc-500">{detailText(result?.detail)}</p>{id === 'identity' && result?.passed && <dl className="mt-3 grid gap-1 text-xs"><div>产品：{result.product}</div><div className="font-mono">MAC：{result.hardware_mac}</div><div>Wi-Fi：{result.wifi ? '支持' : '不支持'} · Bluetooth：{result.bluetooth ? '支持' : '不支持'}</div></dl>}</Card>; })}
        </section>

        <section>
          <h3 className="mb-3 text-base font-semibold">接口接线与依次测试</h3>
          <div className="grid gap-3">{session.steps.map((step, index) => {
            const previousCompleted = index === 0 || session.steps.slice(0, index).every((item) => stepResults[item.id] !== undefined || skippedSteps[item.id]);
            const result = stepResults[step.id];
            const skipped = skippedSteps[step.id];
            return <div key={step.id} className="grid gap-3 rounded-xl border border-zinc-200 p-4 md:grid-cols-[2rem_1fr_auto] md:items-center"><span className="grid size-8 place-items-center rounded-full bg-zinc-100 text-sm font-semibold">{index + 1}</span><div><div className="flex items-center gap-2"><strong className="text-sm">{step.title}</strong>{skipped ? <Badge tone="warning">已跳过</Badge> : <ResultBadge result={result} />}</div><p className="mt-1 text-xs leading-5 text-zinc-500">{step.instruction}</p>{result && !skipped && <p className={`mt-1 text-xs ${result.passed ? 'text-green-700' : 'text-red-700'}`}>{detailText(result.detail)}</p>}</div><div className="flex gap-2"><Button variant="secondary" disabled={!initialPassed || !previousCompleted || runningStep !== null} onClick={() => { setSkippedSteps((value) => ({ ...value, [step.id]: false })); void runStep(step.id); }}>{runningStep === step.id ? "测试中…" : result ? "重新测试" : "开始测试"}</Button>{step.id === "i2c" && <Button variant="ghost" disabled={runningStep !== null} onClick={() => setSkippedSteps((value) => ({ ...value, [step.id]: true }))}>没有模块，跳过</Button>}</div></div>;
          })}</div>
        </section>

        <section>
          <h3 className="mb-1 text-base font-semibold">登记外接设备检查</h3>
          <p className="mb-3 text-xs leading-5 text-zinc-500">I²C 设备可通过扫描自动发现；其他设备需要先完成对应接口回环，再由用户确认设备自身功能。通用体检不会假设厂商私有协议。</p>
          {session.peripherals.length === 0 ? <p className="rounded-xl border border-dashed border-zinc-300 p-5 text-center text-sm text-zinc-500">该主板没有登记外接设备。</p> : <div className="grid gap-3">{session.peripherals.map((peripheral) => { const testId = peripheral.interface_type.toLowerCase(); const interfaceResult = stepResults[testId]; const interfaceSkipped = skippedSteps[testId]; const manual = peripheralResults[peripheral.peripheral_id]; return <div key={peripheral.peripheral_id} className="flex flex-col gap-3 rounded-xl border border-zinc-200 p-4 md:flex-row md:items-center"><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><strong className="text-sm">{peripheral.name}</strong><Badge>{peripheral.type.toUpperCase()}</Badge></div><p className="mt-1 text-xs text-zinc-500">{peripheral.model} · {peripheral.interface_type} · {peripheral.voltage} V</p><p className="mt-1 text-xs">接口检查：{interfaceSkipped ? '已跳过' : interfaceResult ? (interfaceResult.passed ? '通过' : '失败') : '待完成'}</p></div><div className="flex gap-2"><Button variant={manual === true ? 'primary' : 'secondary'} onClick={() => setPeripheralResults((value) => ({ ...value, [peripheral.peripheral_id]: true }))}>设备正常</Button><Button variant={manual === false ? 'danger' : 'secondary'} onClick={() => setPeripheralResults((value) => ({ ...value, [peripheral.peripheral_id]: false }))}>设备异常</Button></div></div>; })}</div>}
        </section>

        <section className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 md:flex-row md:items-center md:justify-between">
          <div><h3 className="text-sm font-semibold">保存本次体检结果</h3><p className="mt-1 text-xs leading-5 text-zinc-500">完成 GPIO、PWM、UART 和 SPI 测试后即可保存；测试失败会如实记录为 False，I²C 与外接设备检查不影响保存。</p></div>
          <Button disabled={!canComplete || completing || runningStep !== null} onClick={() => void completeHealth()}>{completing ? "保存中…" : "完成体检"}</Button>
        </section>
      </>}
    </div>
  </Dialog>;
}
