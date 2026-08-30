export function PageHeader({ eyebrow, title, subtitle, actions }: { eyebrow: string; title: string; subtitle: string; actions?: React.ReactNode }) {
  return <header className="flex flex-col gap-5 border-b border-zinc-200 pb-7 lg:flex-row lg:items-end lg:justify-between"><div><p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">{eyebrow}</p><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-500 sm:text-base">{subtitle}</p></div>{actions && <div className="flex flex-wrap gap-2">{actions}</div>}</header>;
}

export function SectionHeader({ title, action, subtitle }: { title: string; action?: React.ReactNode; subtitle?: string }) {
  return <div className="mb-4 flex items-start justify-between gap-4"><div><h2 className="text-base font-semibold">{title}</h2>{subtitle && <p className="mt-1 text-xs text-zinc-500">{subtitle}</p>}</div>{action}</div>;
}

export function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return <section className="rounded-2xl border border-zinc-200 bg-white p-5"><p className="text-xs font-medium uppercase tracking-wider text-zinc-500">{label}</p><p className="mt-3 text-2xl font-semibold tracking-tight">{value}</p>{hint && <p className="mt-2 text-xs leading-5 text-zinc-500">{hint}</p>}</section>;
}
