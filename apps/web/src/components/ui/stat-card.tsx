export function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <p className="text-2xl font-semibold tabular-nums text-ink">{value}</p>
      <p className="mt-1 text-xs font-medium uppercase tracking-wide text-ink-faint">{label}</p>
    </div>
  );
}

export function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-surface p-5">
      <h2 className="mb-4 text-sm font-semibold text-ink">{title}</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{children}</div>
    </section>
  );
}
