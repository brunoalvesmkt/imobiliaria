"use client";

import { useTheme } from "@/lib/theme";

const BASE_HEIGHT_PX = 32;

/**
 * Logo configurável pelo Master (`PlatformSettings`), com variante por tema
 * e um percentual de tamanho (50–200%). Sem logo cadastrado, cai no
 * distintivo de letra que já existia no lugar.
 */
export function LogoImage({
  lightUrl,
  darkUrl,
  sizePercent,
  fallbackLetter,
  fallbackClassName,
}: {
  lightUrl: string | null | undefined;
  darkUrl: string | null | undefined;
  sizePercent: number | undefined;
  fallbackLetter: string;
  fallbackClassName: string;
}) {
  const { theme } = useTheme();
  const url = (theme === "dark" ? darkUrl : lightUrl) || lightUrl || darkUrl;

  if (!url) {
    return <span className={fallbackClassName}>{fallbackLetter}</span>;
  }

  const heightPx = Math.round(((sizePercent ?? 100) / 100) * BASE_HEIGHT_PX);
  // eslint-disable-next-line @next/next/no-img-element -- data URI/base64, sem otimização de imagem remota a fazer
  return <img src={url} alt="" style={{ height: `${heightPx}px` }} className="w-auto max-w-[180px] object-contain" />;
}
