"use client";

import { CheckCircleIcon, ExclamationTriangleIcon, InformationCircleIcon, XCircleIcon, XMarkIcon } from "@heroicons/react/20/solid";
import { IconButton } from "./controls";

export { Button, Card, Field, IconButton, Input, Select, Textarea } from "./controls";

export function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "info" | "success" | "warning" | "danger" }) {
  const styles = {
    neutral: "border-zinc-200 bg-zinc-50 text-zinc-700",
    info: "border-zinc-300 bg-zinc-100 text-zinc-900",
    success: "border-green-200 bg-green-50 text-green-700",
    warning: "border-amber-200 bg-amber-50 text-amber-800",
    danger: "border-red-200 bg-red-50 text-red-700",
  };
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${styles[tone]}`}>{children}</span>;
}

export function Alert({ children, tone = "info" }: { children: React.ReactNode; tone?: "info" | "success" | "warning" | "danger" }) {
  const Icon = tone === "success" ? CheckCircleIcon : tone === "warning" ? ExclamationTriangleIcon : tone === "danger" ? XCircleIcon : InformationCircleIcon;
  const styles = {
    info: "border-zinc-200 bg-zinc-50 text-zinc-800",
    success: "border-green-200 bg-green-50 text-green-800",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
    danger: "border-red-200 bg-red-50 text-red-800",
  };
  return <div role="status" className={`flex gap-2 rounded-xl border p-3 text-sm ${styles[tone]}`}><Icon className="mt-0.5 size-4 shrink-0" /><div>{children}</div></div>;
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return <div className="grid min-h-40 place-items-center rounded-xl border border-dashed border-zinc-300 p-6 text-center"><div><p className="font-medium">{title}</p>{description && <p className="mt-1 text-sm text-zinc-500">{description}</p>}{action && <div className="mt-4">{action}</div>}</div></div>;
}

export function Dialog({ open, title, closeLabel, onClose, children, size = "default" }: { open: boolean; title: string; closeLabel: string; onClose: () => void; children: React.ReactNode; size?: "default" | "wide" }) {
  if (!open) return null;
  return <div className="fixed inset-0 z-50 grid cursor-pointer place-items-center bg-black/55 p-4" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section role="dialog" aria-modal="true" aria-label={title} className={`max-h-[90vh] w-full ${size === "wide" ? "max-w-6xl" : "max-w-xl"} cursor-default overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-6 text-zinc-950 shadow-2xl`}>
      <header className="mb-5 flex items-center justify-between gap-4"><h2 className="text-lg font-semibold">{title}</h2><IconButton label={closeLabel} onClick={onClose}><XMarkIcon className="size-5" /></IconButton></header>
      {children}
    </section>
  </div>;
}

export function ProgressBar({ running, complete }: { running: boolean; complete: boolean }) {
  return <div className="h-1.5 overflow-hidden rounded-full bg-zinc-200"><div className={`h-full rounded-full bg-zinc-950 ${running ? "w-2/5 animate-pulse" : complete ? "w-full" : "w-0"}`} /></div>;
}
