export function StatusDot({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-block size-1.5 rounded-full ${active ? "bg-zinc-950" : "bg-zinc-300"}`}
      aria-hidden
    />
  );
}
