import type { SiteBranding } from "@/lib/branding";
import { PlanosPageClient } from "./planos-content";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

/**
 * Busca o branding já no servidor (mesmo raciocínio do `generateMetadata`
 * em app/layout.tsx) para a logo/nome corretos irem no HTML desde a
 * primeira resposta — sem isso, a página mostra brevemente o distintivo
 * "C" e o nome padrão até o React Query resolver a busca no cliente.
 * Best-effort: se a API estiver indisponível, o cliente refaz a busca.
 */
async function fetchSiteBranding(): Promise<SiteBranding | null> {
  try {
    const res = await fetch(`${API_URL}/branding/site`, { cache: "no-store" });
    if (!res.ok) throw new Error(`status ${res.status}`);
    return (await res.json()) as SiteBranding;
  } catch {
    return null;
  }
}

export default async function PlanosPage() {
  const initialBranding = await fetchSiteBranding();
  return <PlanosPageClient initialBranding={initialBranding} />;
}
