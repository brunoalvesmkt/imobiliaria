/**
 * Bloqueio progressivo por conta (débito técnico registrado na Fase 1,
 * fechado na Fase 10 — ver DEVELOPMENT_PLAN.md). Complementa o rate limit
 * por IP/rota (`@nestjs/throttler`): aquele limita picos de tráfego de uma
 * origem, este limita tentativas contra uma conta específica mesmo vindas
 * de IPs diferentes (ex.: botnet distribuída tentando 1 conta).
 *
 * A partir da 5ª tentativa falha seguida, a conta trava por um tempo que
 * dobra a cada nova tentativa falha subsequente (1, 2, 4, 8... minutos),
 * até um teto de 60 minutos — suficiente para inviabilizar força bruta sem
 * exigir intervenção manual de suporte a cada bloqueio.
 */

const ATTEMPTS_BEFORE_LOCK = 5;
const MAX_LOCK_MINUTES = 60;

export function computeLockUntil(failedAttemptsAfterThisFailure: number, now = new Date()): Date | null {
  if (failedAttemptsAfterThisFailure < ATTEMPTS_BEFORE_LOCK) {
    return null;
  }
  const minutes = Math.min(2 ** (failedAttemptsAfterThisFailure - ATTEMPTS_BEFORE_LOCK), MAX_LOCK_MINUTES);
  return new Date(now.getTime() + minutes * 60_000);
}

export function isCurrentlyLocked(lockedUntil: Date | null, now = new Date()): boolean {
  return lockedUntil !== null && lockedUntil > now;
}

export function minutesUntil(lockedUntil: Date, now = new Date()): number {
  return Math.max(1, Math.ceil((lockedUntil.getTime() - now.getTime()) / 60_000));
}
