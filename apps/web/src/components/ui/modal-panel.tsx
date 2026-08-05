"use client";

import { useI18n } from "@/lib/i18n";

/** Modal centralizado genérico — extraído do CRM > Funil para ser reaproveitado onde mais telas precisarem abrir um formulário em overlay (ex.: Atendimento > Caixa de entrada). */
export function ModalPanel({
  title,
  onClose,
  children,
  maxWidth = "max-w-sm",
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
}) {
  const { t } = useI18n();
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className={`w-full ${maxWidth} max-h-[90vh] overflow-y-auto rounded-lg border border-line bg-surface p-5 shadow-lg`}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">{title}</h2>
          <button type="button" onClick={onClose} className="text-ink-faint hover:text-ink" aria-label={t("common.close")}>
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
