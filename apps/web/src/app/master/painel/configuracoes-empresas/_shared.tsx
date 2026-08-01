export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-surface p-4">
      <h2 className="mb-3 text-sm font-semibold text-ink">{title}</h2>
      <div className="flex flex-col gap-2.5">{children}</div>
    </section>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-2 text-sm text-ink-dim">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}
