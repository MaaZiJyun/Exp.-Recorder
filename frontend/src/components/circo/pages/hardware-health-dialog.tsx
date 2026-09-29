"use client";

import { useEffect, useState } from "react";
import type { Board, XiaoHealthJob, XiaoHealthResult, XiaoHealthSession, XiaoSerialPort } from "@/app/types";
import { api } from "@/app/lib";
import { Alert, Badge, Button, Card, Dialog, Field, Select } from "@/components/circo/primitives";

type PortResponse = {
  ports: XiaoSerialPort[];
  arduino_cli_available: boolean;
};

const gpioPins = Array.from({ length: 11 }, (_, index) => `D${index}`);

function ResultBadge({ result }: { result?: XiaoHealthResult }) {
  if (!result) return <Badge>Pending</Badge>;
  if (result.skipped) return <Badge tone="info">Already installed — flash skipped</Badge>;
  return <Badge tone={result.passed ? "success" : "danger"}>{result.passed ? "Passed" : "Failed"}</Badge>;
}

function detailText(detail: XiaoHealthResult["detail"] | undefined) {
  if (!detail) return "";
  if (typeof detail === "string") return detail;
  const port = detail as Partial<XiaoSerialPort>;
  return [port.product, port.manufacturer, port.serial_number, port.device].filter(Boolean).join(" · ");
}

export function HardwareHealthDialog({ board, creating = false, onClose, onCompleted }: { board: Board | null; creating?: boolean; onClose: () => void; onCompleted: (board: Board) => void }) {
  const [ports, setPorts] = useState<XiaoSerialPort[]>([]);
  const [selectedPort, setSelectedPort] = useState("");
  const [toolAvailable, setToolAvailable] = useState(true);
  const [loadingPorts, setLoadingPorts] = useState(false);
  const [running, setRunning] = useState(false);
  const [runningStep, setRunningStep] = useState<string | null>(null);
  const [gpioPair, setGpioPair] = useState({ first: "D0", second: "D1" });
  const [completing, setCompleting] = useState(false);
  const [session, setSession] = useState<XiaoHealthSession | null>(null);
  const [healthJob, setHealthJob] = useState<XiaoHealthJob | null>(null);
  const [stepResults, setStepResults] = useState<Record<string, XiaoHealthResult>>({});
  const [skippedSteps, setSkippedSteps] = useState<Record<string, boolean>>({});
  const [peripheralResults, setPeripheralResults] = useState<Record<number, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const open = creating || board !== null;

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      setSession(null);
      setHealthJob(null);
      setStepResults({});
      setGpioPair({ first: "D0", second: "D1" });
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
        .catch((reason) => setError(reason instanceof Error ? reason.message : "USB device scan failed"))
        .finally(() => setLoadingPorts(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [board, open]);

  const start = async () => {
    if (!selectedPort) return;
    setRunning(true);
    setError(null);
    setSession(null);
    setHealthJob(null);
    try {
      const path = board ? `/boards/${board.board_id}/health/xiao/start` : "/hardware-health/xiao/start";
      let job = await api<XiaoHealthJob>(path, { method: "POST", body: JSON.stringify({ port: selectedPort, flash: true }) });
      setHealthJob(job);
      while (job.status === "queued" || job.status === "running") {
        await new Promise((resolve) => window.setTimeout(resolve, 500));
        job = await api<XiaoHealthJob>(`/hardware-health/jobs/${job.job_id}`);
        setHealthJob(job);
      }
      if (job.status === "completed" && job.result) setSession(job.result);
      else throw new Error(job.message || "Background health-check job failed");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Failed to start health check");
    } finally {
      setRunning(false);
    }
  };

  const runStep = async (id: string) => {
    if (!session) return;
    setRunningStep(id);
    setError(null);
    try {
      const path = board ? `/boards/${board.board_id}/health/xiao/test` : "/hardware-health/xiao/test";
      const response = await api<{ result: XiaoHealthResult }>(path, { method: "POST", body: JSON.stringify({ port: session.port, test: id, ...(id === "gpio" ? { pin_a: gpioPair.first, pin_b: gpioPair.second } : {}) }) });
      setStepResults((current) => ({ ...current, [id]: response.result }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Interface test failed");
    } finally {
      setRunningStep(null);
    }
  };

  const changeGpioPin = (side: "first" | "second", value: string) => {
    setGpioPair((current) => ({ ...current, [side]: value }));
    setStepResults((current) => {
      const next = { ...current };
      delete next.gpio;
      return next;
    });
  };

  const initialPassed = Boolean(session?.checks.usb?.passed && session?.checks.flash?.passed && session?.checks.identity?.passed && session?.checks.hello?.passed);
  const requiredInterfaceIds = ["gpio", "pwm", "uart", "spi"] as const;
  const canComplete = Boolean(
    session?.checks.identity?.product
    && session.checks.identity.hardware_mac
    && requiredInterfaceIds.every((id) => stepResults[id] !== undefined),
  );

  const completeHealth = async () => {
    if (!session || !canComplete) return;
    setCompleting(true);
    setError(null);
    try {
      const identity = session.checks.identity;
      const updated = await api<Board>(board ? `/boards/${board.board_id}/health-result` : "/boards/from-health", {
        method: board ? "PUT" : "POST",
        body: JSON.stringify({
          usb_detected: Boolean(session.checks.usb?.passed),
          model: identity.product,
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
      setError(reason instanceof Error ? reason.message : "Failed to save health-check results");
    } finally {
      setCompleting(false);
    }
  };

  return <Dialog open={open} title={board ? `Board Health Check · ${board.model} · ${board.mac}` : "New Board Health Check"} closeLabel="Close" onClose={onClose} size="wide">
    <div className="grid gap-6">
      <Alert tone="warning"><strong>Inventory diagnostic mode:</strong> This check flashes dedicated firmware to the selected inventory board and overwrites its existing program. XIAO serial ports used by the experiment rig are locked and cannot be selected.</Alert>
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="grid gap-4 rounded-xl border border-zinc-200 p-4 md:grid-cols-[1fr_2fr_auto] md:items-end">
        <Field label="Health-Check Type"><Select value="xiao-esp32s3" disabled><option value="xiao-esp32s3">XIAO ESP32S3</option></Select></Field>
        <Field label="Inventory Board USB Port"><Select value={selectedPort} disabled={loadingPorts || running} onChange={(event) => setSelectedPort(event.target.value)}><option value="">{loadingPorts ? "Scanning…" : "Select a USB device…"}</option>{ports.map((port) => <option key={port.device} value={port.device} disabled={port.reserved_by_experiment}>{port.device} · {port.product ?? "USB Serial"}{port.reserved_by_experiment ? " (in use by experiment rig)" : ""}</option>)}</Select></Field>
        <Button onClick={() => void start()} disabled={!selectedPort || !toolAvailable || running}>{running ? "Health Check Running…" : "Check Firmware and Start"}</Button>
      </div>
      {!toolAvailable && <Alert tone="danger">arduino-cli was not found. Install Arduino CLI and the esp32:esp32 core first.</Alert>}

      {healthJob && <section className="overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950 text-zinc-100">
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3"><div><p className="text-sm font-semibold">Background Activity</p><p className="mt-1 text-xs text-zinc-400">{healthJob.message}</p></div><Badge tone={healthJob.status === "completed" ? "success" : healthJob.status === "failed" ? "danger" : "warning"}>{healthJob.status.toUpperCase()}</Badge></div>
        <div className="max-h-56 overflow-y-auto p-4 font-mono text-xs leading-6">{healthJob.logs.map((log, index) => <div className="grid grid-cols-[5rem_8rem_1fr] gap-3" key={`${log.timestamp}-${index}`}><time className="text-zinc-500">{log.timestamp.slice(11, 19)}</time><span className="text-cyan-400">{log.stage}</span><span className="break-all text-zinc-300">{log.message}</span></div>)}</div>
      </section>}

      {session && <>
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[['usb', 'USB Detection'], ['flash', 'Diagnostic Firmware'], ['identity', 'Chip Identity and Wireless Features'], ['hello', 'Hello World Program']].map(([id, title]) => { const result = session.checks[id]; return <Card key={id} className="p-4"><div className="flex items-start justify-between gap-3"><h3 className="text-sm font-semibold">{title}</h3><ResultBadge result={result} /></div><p className="mt-3 break-all text-xs leading-5 text-zinc-500">{detailText(result?.detail)}</p>{id === 'identity' && result?.passed && <dl className="mt-3 grid gap-1 text-xs"><div>Product: {result.product}</div><div className="font-mono">MAC: {result.hardware_mac}</div><div>Wi-Fi: {result.wifi ? 'Supported' : 'Not supported'} · Bluetooth: {result.bluetooth ? 'Supported' : 'Not supported'}</div></dl>}</Card>; })}
        </section>

        <section>
          <h3 className="mb-3 text-base font-semibold">Interface Wiring and Sequential Tests</h3>
          <div className="grid gap-3">{session.steps.map((step, index) => {
            const previousCompleted = index === 0 || session.steps.slice(0, index).every((item) => stepResults[item.id] !== undefined || skippedSteps[item.id]);
            const result = stepResults[step.id];
            const skipped = skippedSteps[step.id];
            return <div key={step.id} className="grid gap-3 rounded-xl border border-zinc-200 p-4 md:grid-cols-[2rem_1fr_auto] md:items-center"><span className="grid size-8 place-items-center rounded-full bg-zinc-100 text-sm font-semibold">{index + 1}</span><div><div className="flex items-center gap-2"><strong className="text-sm">{step.title}</strong>{skipped ? <Badge tone="warning">Skipped</Badge> : <ResultBadge result={result} />}</div>{step.id === "gpio" ? <><div className="mt-3 flex max-w-sm items-center gap-2"><Select aria-label="First GPIO pin" value={gpioPair.first} disabled={runningStep !== null} onChange={(event) => changeGpioPin("first", event.target.value)}>{gpioPins.map((pin) => <option key={pin} value={pin} disabled={pin === gpioPair.second}>{pin}</option>)}</Select><span className="text-sm text-zinc-500">↔</span><Select aria-label="Second GPIO pin" value={gpioPair.second} disabled={runningStep !== null} onChange={(event) => changeGpioPin("second", event.target.value)}>{gpioPins.map((pin) => <option key={pin} value={pin} disabled={pin === gpioPair.first}>{pin}</option>)}</Select></div><p className="mt-2 text-xs leading-5 text-zinc-500">Power off the board, connect {gpioPair.first} and {gpioPair.second} with a jumper wire, then power it on again.</p></> : <p className="mt-1 text-xs leading-5 text-zinc-500">{step.instruction}</p>}{result && !skipped && <p className={`mt-1 text-xs ${result.passed ? 'text-green-700' : 'text-red-700'}`}>{detailText(result.detail)}</p>}</div><div className="flex gap-2"><Button variant="secondary" disabled={!initialPassed || !previousCompleted || runningStep !== null} onClick={() => { setSkippedSteps((value) => ({ ...value, [step.id]: false })); void runStep(step.id); }}>{runningStep === step.id ? "Testing…" : result ? "Retest" : "Start Test"}</Button>{step.id === "i2c" && <Button variant="ghost" disabled={runningStep !== null} onClick={() => setSkippedSteps((value) => ({ ...value, [step.id]: true }))}>No Module — Skip</Button>}</div></div>;
          })}</div>
        </section>

        <section>
          <h3 className="mb-1 text-base font-semibold">Registered Peripheral Check</h3>
          <p className="mb-3 text-xs leading-5 text-zinc-500">I²C devices can be discovered automatically. Other devices require the matching interface loopback test and manual confirmation of device operation. The generic health check does not assume vendor-specific protocols.</p>
          {session.peripherals.length === 0 ? <p className="rounded-xl border border-dashed border-zinc-300 p-5 text-center text-sm text-zinc-500">No peripherals are registered to this board.</p> : <div className="grid gap-3">{session.peripherals.map((peripheral) => { const testId = peripheral.interface_type.toLowerCase(); const interfaceResult = stepResults[testId]; const interfaceSkipped = skippedSteps[testId]; const manual = peripheralResults[peripheral.peripheral_id]; return <div key={peripheral.peripheral_id} className="flex flex-col gap-3 rounded-xl border border-zinc-200 p-4 md:flex-row md:items-center"><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><strong className="text-sm">{peripheral.name}</strong><Badge>{peripheral.type.toUpperCase()}</Badge></div><p className="mt-1 text-xs text-zinc-500">{peripheral.model} · {peripheral.interface_type} · {peripheral.voltage} V</p><p className="mt-1 text-xs">Interface check: {interfaceSkipped ? 'Skipped' : interfaceResult ? (interfaceResult.passed ? 'Passed' : 'Failed') : 'Pending'}</p></div><div className="flex gap-2"><Button variant={manual === true ? 'primary' : 'secondary'} onClick={() => setPeripheralResults((value) => ({ ...value, [peripheral.peripheral_id]: true }))}>Device Working</Button><Button variant={manual === false ? 'danger' : 'secondary'} onClick={() => setPeripheralResults((value) => ({ ...value, [peripheral.peripheral_id]: false }))}>Device Faulty</Button></div></div>; })}</div>}
        </section>

        <section className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 md:flex-row md:items-center md:justify-between">
          <div><h3 className="text-sm font-semibold">Save Health-Check Results</h3><p className="mt-1 text-xs leading-5 text-zinc-500">Results can be saved after the GPIO, PWM, UART, and SPI tests are complete. Failed tests are recorded as False. I²C and peripheral checks do not block saving.</p></div>
          <Button disabled={!canComplete || completing || runningStep !== null} onClick={() => void completeHealth()}>{completing ? "Saving…" : "Complete Health Check"}</Button>
        </section>
      </>}
    </div>
  </Dialog>;
}
