"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useAutomation, useAutomationExecutions, type AutomationExecution } from "@/lib/automation";
import { useI18n } from "@/lib/i18n";
import type { DictionaryKey } from "@/lib/i18n/dictionaries/pt-BR";

export default function AutomationExecutionsPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { t, locale } = useI18n();
  const automation = useAutomation(id);
  const executions = useAutomationExecutions(id);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <Link href={`/painel/automacao/${id}`} className="text-xs font-medium text-ink-dim hover:text-ink">
            ← {automation.data?.nome ?? t("automation.back")}
          </Link>
          <h1 className="mt-1 text-lg font-semibold text-ink">{t("automation.executions.title")}</h1>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-surface-alt text-left text-xs font-medium uppercase tracking-wide text-ink-faint">
              <th className="px-4 py-2">{t("automation.executions.columnStatus")}</th>
              <th className="px-4 py-2">{t("automation.executions.columnTrigger")}</th>
              <th className="px-4 py-2">{t("automation.executions.columnAttempts")}</th>
              <th className="px-4 py-2">{t("automation.executions.columnError")}</th>
              <th className="px-4 py-2">{t("automation.executions.columnDate")}</th>
            </tr>
          </thead>
          <tbody>
            {executions.data?.map((execution) => (
              <ExecutionRow key={execution.id} execution={execution} locale={locale} />
            ))}
            {executions.data?.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-ink-faint">
                  {t("automation.executions.empty")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ExecutionRow({ execution, locale }: { execution: AutomationExecution; locale: string }) {
  const { t } = useI18n();
  const classes: Record<AutomationExecution["status"], string> = {
    pending: "bg-surface-muted text-ink-dim",
    running: "bg-brand-50 text-brand-700",
    success: "bg-brand-50 text-brand-700",
    failed: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    dead_letter: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
  };
  return (
    <tr className="border-b border-line last:border-0">
      <td className="px-4 py-2">
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${classes[execution.status]}`}>
          {t(`automation.executions.status.${execution.status}` as DictionaryKey)}
        </span>
      </td>
      <td className="px-4 py-2 text-ink-dim">{execution.gatilhoDisparado}</td>
      <td className="px-4 py-2 text-ink-dim">{execution.tentativas}</td>
      <td className="px-4 py-2 text-ink-dim">{execution.erro ?? "—"}</td>
      <td className="px-4 py-2 text-ink-faint">{new Date(execution.createdAt).toLocaleString(locale)}</td>
    </tr>
  );
}
