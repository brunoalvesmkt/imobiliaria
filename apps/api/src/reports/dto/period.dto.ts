import { IsIn, IsISO8601, IsOptional } from "class-validator";

export const PERIOD_PRESETS = ["hoje", "ontem", "7dias", "30dias", "esteMes", "esteAno", "vitalicio", "personalizado"] as const;
export type PeriodPreset = (typeof PERIOD_PRESETS)[number];

export const COMPARE_MODES = [
  "nenhum",
  "periodoAnterior",
  "ontem",
  "7diasAnteriores",
  "30diasAnteriores",
  "mesAnterior",
  "anoAnterior",
  "personalizado",
] as const;
export type CompareMode = (typeof COMPARE_MODES)[number];

export class PeriodQueryDto {
  @IsOptional()
  @IsIn(PERIOD_PRESETS)
  preset?: PeriodPreset;

  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

  @IsOptional()
  @IsIn(COMPARE_MODES)
  compare?: CompareMode;

  @IsOptional()
  @IsISO8601()
  compareFrom?: string;

  @IsOptional()
  @IsISO8601()
  compareTo?: string;
}

export interface ResolvedPeriod {
  current: { from: Date; to: Date };
  previous: { from: Date; to: Date } | null;
  label: string;
  previousLabel: string | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("pt-BR");
}

function periodLabel(from: Date, to: Date): string {
  return `${formatDate(from)} a ${formatDate(to)}`;
}

/**
 * Resolve o intervalo atual a partir do preset/personalizado do spec do
 * Dashboard, e — quando aplicável — o intervalo de comparação equivalente.
 * Usa horário local do servidor, mesmo comportamento de `resolveDateRange`
 * (não há timezone por tenant hoje).
 */
export function resolvePeriod(dto: PeriodQueryDto): ResolvedPeriod {
  const now = new Date();
  const preset = dto.preset ?? "30dias";
  const current = resolveCurrentRange(preset, now, dto.from, dto.to);
  const previous = resolveCompareRange(dto.compare ?? "nenhum", current, dto.compareFrom, dto.compareTo);

  return {
    current,
    previous,
    label: periodLabel(current.from, current.to),
    previousLabel: previous ? periodLabel(previous.from, previous.to) : null,
  };
}

function resolveCurrentRange(preset: PeriodPreset, now: Date, customFrom?: string, customTo?: string): { from: Date; to: Date } {
  switch (preset) {
    case "hoje":
      return { from: startOfDay(now), to: now };
    case "ontem": {
      const yesterday = new Date(now.getTime() - DAY_MS);
      return { from: startOfDay(yesterday), to: endOfDay(yesterday) };
    }
    case "7dias": {
      const yesterday = new Date(now.getTime() - DAY_MS);
      return { from: startOfDay(new Date(yesterday.getTime() - 6 * DAY_MS)), to: endOfDay(yesterday) };
    }
    case "30dias": {
      const yesterday = new Date(now.getTime() - DAY_MS);
      return { from: startOfDay(new Date(yesterday.getTime() - 29 * DAY_MS)), to: endOfDay(yesterday) };
    }
    case "esteMes":
      return { from: new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0), to: now };
    case "esteAno":
      return { from: new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0), to: now };
    case "vitalicio":
      return { from: new Date(2000, 0, 1), to: now };
    case "personalizado": {
      const from = customFrom ? startOfDay(new Date(customFrom)) : startOfDay(new Date(now.getTime() - 29 * DAY_MS));
      const to = customTo ? endOfDay(new Date(customTo)) : now;
      return { from, to };
    }
  }
}

function resolveCompareRange(
  compare: CompareMode,
  current: { from: Date; to: Date },
  compareFrom?: string,
  compareTo?: string,
): { from: Date; to: Date } | null {
  if (compare === "nenhum") return null;

  switch (compare) {
    case "ontem": {
      const yesterday = new Date(current.from.getTime() - DAY_MS);
      return { from: startOfDay(yesterday), to: endOfDay(yesterday) };
    }
    case "7diasAnteriores": {
      const durationMs = current.to.getTime() - current.from.getTime();
      const to = new Date(current.from.getTime() - 1);
      const from = new Date(to.getTime() - durationMs);
      return { from, to };
    }
    case "30diasAnteriores": {
      const durationMs = current.to.getTime() - current.from.getTime();
      const to = new Date(current.from.getTime() - 1);
      const from = new Date(to.getTime() - durationMs);
      return { from, to };
    }
    case "mesAnterior": {
      const prevMonthDate = new Date(current.from.getFullYear(), current.from.getMonth() - 1, 1);
      const dayOfMonth = Math.min(current.to.getDate(), new Date(prevMonthDate.getFullYear(), prevMonthDate.getMonth() + 1, 0).getDate());
      return {
        from: new Date(prevMonthDate.getFullYear(), prevMonthDate.getMonth(), 1, 0, 0, 0, 0),
        to: new Date(prevMonthDate.getFullYear(), prevMonthDate.getMonth(), dayOfMonth, 23, 59, 59, 999),
      };
    }
    case "anoAnterior": {
      const prevYear = current.from.getFullYear() - 1;
      return {
        from: new Date(prevYear, current.from.getMonth(), current.from.getDate(), 0, 0, 0, 0),
        to: new Date(prevYear, current.to.getMonth(), current.to.getDate(), 23, 59, 59, 999),
      };
    }
    case "personalizado": {
      if (compareFrom && compareTo) {
        return { from: startOfDay(new Date(compareFrom)), to: endOfDay(new Date(compareTo)) };
      }
      return resolveCompareRange("periodoAnterior", current);
    }
    case "periodoAnterior":
    default: {
      const durationMs = current.to.getTime() - current.from.getTime();
      const to = new Date(current.from.getTime() - 1);
      const from = new Date(to.getTime() - durationMs);
      return { from, to };
    }
  }
}
