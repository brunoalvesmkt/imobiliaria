import { NextResponse, type NextRequest } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

interface PanelGuard {
  cookie: string;
  meEndpoint: string;
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
 */
const GUARDS: PanelGuard[] = [
  { cookie: "tenant_access_token", meEndpoint: "/auth/tenant/me", loginPath: "/login" },
  { cookie: "master_access_token", meEndpoint: "/auth/master/me", loginPath: "/master/login" },
  { cookie: "affiliate_access_token", meEndpoint: "/auth/affiliate/me", loginPath: "/afiliado/login" },
];

function guardFor(pathname: string): PanelGuard | undefined {
  if (pathname.startsWith("/painel")) return GUARDS[0];
  if (pathname.startsWith("/master/painel")) return GUARDS[1];
  if (pathname.startsWith("/afiliado/painel")) return GUARDS[2];
  return undefined;
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const guard = guardFor(request.nextUrl.pathname);
  if (!guard) return NextResponse.next();

  const token = request.cookies.get(guard.cookie)?.value;
  if (!token) {
    return redirectToLogin(request, guard.loginPath);
  }

  try {
    const res = await fetch(`${API_URL}${guard.meEndpoint}`, {
      headers: { cookie: request.headers.get("cookie") ?? "" },
    });
    if (res.status === 401 || res.status === 403) {
      return redirectToLogin(request, guard.loginPath);
    }
  } catch {
    // API indisponível — client-side cuida do redirect se a sessão for mesmo inválida.
  }

  return NextResponse.next();
}

function redirectToLogin(request: NextRequest, loginPath: string): NextResponse {
  const loginUrl = new URL(loginPath, request.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/painel/:path*", "/master/painel/:path*", "/afiliado/painel/:path*"],
};
