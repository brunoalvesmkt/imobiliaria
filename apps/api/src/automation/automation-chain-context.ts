import { AsyncLocalStorage } from "node:async_hooks";

export interface AutomationChainStore {
  executionId: string;
  depth: number;
}

/**
 * Propaga a profundidade da corrente de automações que se disparam entre si
 * (ex.: a ação "start_chatbot" conclui um fluxo sincronamente e emite um
 * novo evento de domínio, que o AutomationEngineService escuta e pode
 * disparar outra automação) — mesmo padrão de
 * `common/tenant/tenant-context.ts`. Cada job do BullMQ roda em um contexto
 * assíncrono novo, então a profundidade recebida via job data é quem
 * inicializa o contexto a cada execução (ver AutomationProcessor.runExecution).
 */
export const automationChainStorage = new AsyncLocalStorage<AutomationChainStore>();

export function getCurrentAutomationChainDepth(): number {
  return automationChainStorage.getStore()?.depth ?? 0;
}

export function isInsideAutomationChain(): boolean {
  return automationChainStorage.getStore() !== undefined;
}

export function runWithAutomationChain<T>(store: AutomationChainStore, fn: () => Promise<T>): Promise<T> {
  return automationChainStorage.run(store, fn);
}
