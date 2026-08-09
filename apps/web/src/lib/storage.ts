import { useQuery } from "@tanstack/react-query";
import { apiGet } from "./api-client";

export interface StorageUsage {
  usedBytes: number;
  limitMb: number | null;
  unlimited: boolean;
  percentage: number | null;
  categories: { imagensVideos: number; audios: number; documentos: number; outros: number };
  updatedAt: string | null;
}

export function useStorageUsage(enabled = true) {
  return useQuery({
    queryKey: ["storage", "usage"],
    queryFn: () => apiGet<StorageUsage>("/storage/usage"),
    enabled,
  });
}

const BYTES_PER_GB = 1024 * 1024 * 1024;

/** Sempre em GB, 2 casas decimais, vírgula — nunca alterna entre B/KB/MB/GB (ver documento de alterações, item 7). */
export function formatGb(bytes: number, locale: string): string {
  const gb = bytes / BYTES_PER_GB;
  return `${gb.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} GB`;
}

export function formatLimitGb(limitMb: number | null, unlimited: boolean, locale: string, unlimitedLabel: string): string {
  if (unlimited || limitMb == null) return unlimitedLabel;
  return formatGb(limitMb * 1024 * 1024, locale);
}

export type StorageStatus = "normal" | "atencao" | "alerta" | "limite";

export function storageStatus(percentage: number | null): StorageStatus {
  if (percentage == null) return "normal";
  if (percentage >= 100) return "limite";
  if (percentage >= 90) return "alerta";
  if (percentage >= 80) return "atencao";
  return "normal";
}

export const STORAGE_STATUS_CLASSES: Record<StorageStatus, string> = {
  normal: "bg-brand-500",
  atencao: "bg-amber-400",
  alerta: "bg-orange-500",
  limite: "bg-red-600",
};

export const STORAGE_STATUS_TEXT_CLASSES: Record<StorageStatus, string> = {
  normal: "text-ink-dim",
  atencao: "text-amber-700 dark:text-amber-300",
  alerta: "text-orange-700 dark:text-orange-300",
  limite: "text-red-600",
};
