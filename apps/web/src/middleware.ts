import { NextResponse, type NextRequest } from "next/server";

// `API_URL` (sem NEXT_PUBLIC_) é lida só no servidor — em produção (Docker
// Compose) aponta para o serviço "api" na rede interna do container
// (ex.: http://api:3001), evitando que essa checagem em toda navegação
// precise sair para a internet e voltar pelo Traefik só para falar com o
// próprio backend (lento e instável dentro do container). `NEXT_PUBLIC_API_URL`
// continua sendo o único usado pelo navegador (cliente).
const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

interface PanelGuard {
  accessCookie: string;
  refreshCookie: string;
  meEndpoint: string;
  refreshEndpoint: string;
  loginPath: string;
}

/**
 * Fase 46/48 (ver DEVELOPMENT_PLAN.md): proteção de rota feita no servidor,
 * não mais só no cliente — débito registrado desde a Fase F1 ("flash breve
 * de carregamento antes do redirect"), inicialmente fechado só para o
 * painel do tenant (Fase 46) e estendido aqui aos painéis Master e Afiliado,
 * que usavam exatamente o mesmo padrão client-only. Os três cookies de
 * sessão são setados pela API sem `Domain` explícito (host-only para
 * "localhost"), então o navegador os envia tanto para a API (porta 3001)
 * quanto para este servidor Next.js (porta 3000) — dá para checar a sessão
 * aqui sem precisar de um proxy de cookies entre domínios.
 *
 * Verificação é best-effort: se a API estiver indisponível, deixa passar
 * (o client-side já tem o próprio fallback de redirect) em vez de derrubar
 * o painel inteiro por uma falha transitória de rede no middleware.
 *
 * Item 19 do documento de alterações ("sessões sem logout frequente"): o
 * access token dura só 15min. Antes desta correção, o middleware só olhava
 * a presença/validade desse cookie e mandava pro login assim que ele
 * expirava — mesmo com um refresh token ainda válido, derrubando o usuário
 * a cada 15min de navegação (bug real reportado em produção). Agora, antes
 * de redirecionar, tenta renovar a sessão via `<meEndpoint>/../refresh` e
 * repassa os `Set-Cookie` da resposta pro navegador — só vira logout de
 * fato quando o refresh token também expirou/foi revogado. Mesmo padrão
 * (retry-once em cima de um 401) já usado no cliente em `lib/api-client.ts`.
 */
const TENANT_GUARD: PanelGuard = {
  accessCookie: "tenant_access_token",
  refreshCookie: "tenant_refresh_token",
  meEndpoint: "/auth/tenant/me",
  refreshEndpoint: "/auth/tenant/refresh",
  loginPath: "/login",
};
const MASTER_GUARD: PanelGuard = {
  accessCookie: "master_access_token",
  refreshCookie: "master_refresh_token",
  meEndpoint: "/auth/master/me",
  refreshEndpoint: "/auth/master/refresh",
  loginPath: "/master/login",
};
const AFFILIATE_GUARD: PanelGuard = {
  accessCookie: "affiliate_access_token",
  refreshCookie: "affiliate_refresh_token",
  meEndpoint: "/auth/affiliate/me",
  refreshEndpoint: "/auth/affiliate/refresh",
  loginPath: "/afiliado/login",
};

function guardFor(pathname: string): PanelGuard | undefined {
  if (pathname.startsWith("/painel")) return TENANT_GUARD;
  if (pathname.startsWith("/master/painel")) return MASTER_GUARD;
  if (pathname.startsWith("/afiliado/painel")) return AFFILIATE_GUARD;
  return undefined;
}

/** `Response.headers.getSetCookie()` (padrão WHATWG mais recente, suportado pelo runtime de middleware do Next.js) devolve cada `Set-Cookie` separado — `.get()` sozinho perderia um dos dois cookies (access+refresh) num header multi-valor. */
function getSetCookieStrings(res: Response): string[] {
  const headers = res.headers as Headers & { getSetCookie?: () => string[] };
  if (typeof headers.getSetCookie === "function") {
    return headers.getSetCookie();
  }
  const single = res.headers.get("set-cookie");
  return single ? [single] : [];
}

function cookieNameValue(setCookieStr: string): { name: string; value: string } | null {
  const pair = setCookieStr.split(";")[0];
  if (!pair) return null;
  const eq = pair.indexOf("=");
  if (eq === -1) return null;
  return { name: pair.slice(0, eq).trim(), value: pair.slice(eq + 1).trim() };
}

/** Funde os `Set-Cookie` da renovação no header `Cookie` da próxima requisição — precisamos do access token novo pra já checar `/me` na mesma passada. */
function mergeCookieHeader(base: string, setCookies: string[]): string {
  const jar = new Map<string, string>();
  for (const part of base.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    jar.set(trimmed.slice(0, eq), trimmed.slice(eq + 1));
  }
  for (const sc of setCookies) {
    const nv = cookieNameValue(sc);
    if (nv) jar.set(nv.name, nv.value);
  }
  return Array.from(jar.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

function forwardSetCookies(response: NextResponse, setCookies: string[]): void {
  for (const sc of setCookies) {
    response.headers.append("set-cookie", sc);
  }
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const guard = guardFor(request.nextUrl.pathname);
  if (!guard) return NextResponse.next();
  const g = guard; // narrowing não atravessa a closure de attemptRefresh() abaixo — const local sem `| undefined` resolve.

  let cookieHeader = request.headers.get("cookie") ?? "";
  let refreshedSetCookies: string[] = [];
  const hasRefreshToken = !!request.cookies.get(g.refreshCookie)?.value;

  async function attemptRefresh(): Promise<boolean> {
    if (refreshedSetCookies.length > 0) return true; // já tentou nesta requisição
    if (!hasRefreshToken) return false;
    try {
      const res = await fetch(`${API_URL}${g.refreshEndpoint}`, {
        method: "POST",
        headers: { cookie: cookieHeader },
      });
      if (!res.ok) return false;
      const setCookies = getSetCookieStrings(res);
      if (setCookies.length === 0) return false;
      refreshedSetCookies = setCookies;
      cookieHeader = mergeCookieHeader(cookieHeader, setCookies);
      return true;
    } catch {
      return false;
    }
  }

  const hasAccessToken = !!request.cookies.get(g.accessCookie)?.value;
  if (!hasAccessToken && !(await attemptRefresh())) {
    return redirectToLogin(request, g.loginPath);
  }

  try {
    let meRes = await fetch(`${API_URL}${g.meEndpoint}`, { headers: { cookie: cookieHeader } });

    if (meRes.status === 401 || meRes.status === 403) {
      if (!(await attemptRefresh())) {
        return redirectToLogin(request, g.loginPath);
      }
      meRes = await fetch(`${API_URL}${g.meEndpoint}`, { headers: { cookie: cookieHeader } });
      if (meRes.status === 401 || meRes.status === 403) {
        return redirectToLogin(request, g.loginPath);
      }
    }

    // Documento de alterações, seção 4: enquanto o e-mail da empresa não
    // for confirmado, nenhuma rota do painel do tenant deve carregar (as
    // chamadas de dados dela dariam 403 de qualquer forma, ver
    // TenantAuthGuard) — manda direto para a tela de confirmação.
    if (g === TENANT_GUARD && meRes.ok) {
      const body = (await meRes.json()) as { emailConfirmed?: boolean };
      if (body.emailConfirmed === false && request.nextUrl.pathname !== "/confirmar-email") {
        const response = NextResponse.redirect(new URL("/confirmar-email", request.url));
        forwardSetCookies(response, refreshedSetCookies);
        return response;
      }
    }
  } catch {
    // API indisponível — client-side cuida do redirect se a sessão for mesmo inválida.
  }

  const response = NextResponse.next();
  forwardSetCookies(response, refreshedSetCookies);
  return response;
}

function redirectToLogin(request: NextRequest, loginPath: string): NextResponse {
  const loginUrl = new URL(loginPath, request.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/painel/:path*", "/master/painel/:path*", "/afiliado/painel/:path*"],
};
