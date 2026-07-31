type Tone = "error" | "success" | "info";

const TONE_CLASSES: Record<Tone, string> = {
  error: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900",
  success: "bg-brand-50 text-brand-700 border-brand-200",
  info: "bg-surface-muted text-ink-dim border-line",
};

export function Alert({ tone = "info", children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-md border px-3 py-2 text-sm ${TONE_CLASSES[tone]}`}>
      {children}
    </div>
  );
}
