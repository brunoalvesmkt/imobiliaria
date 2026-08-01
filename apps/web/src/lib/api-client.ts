const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

/** Monta a URL absoluta da API para casos que não passam por `apiFetch` (ex.: download de arquivo via `<a href>`, que precisa navegar com o cookie de sessão em vez de um fetch JSON). */
export function apiUrl(path: string): string {
  return `${API_URL}${path}`;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function extractMessage(body: unknown, fallback: string): string {
  if (body && typeof body === "object" && "message" in body) {
    const { message } = body as { message: unknown };
    if (typeof message === "string") return message;
    if (Array.isArray(message)) return message.join(" ");
  }
  return fallback;
}

type AuthScope = "master" | "affiliate" | "tenant";

const REFRESH_PATH: Record<AuthScope, string> = {
  master: "/auth/master/refresh",
  affiliate: "/auth/affiliate/refresh",
  tenant: "/auth/tenant/refresh",
};

function scopeFor(path: string): AuthScope {
  if (path.startsWith("/master")) return "master";
  if (path.startsWith("/affiliate") || path.startsWith("/auth/affiliate")) return "affiliate";
  return "tenant";
}

/** Uma única chamada de refresh em voo por escopo — evita disparar N refreshes quando várias requisições expiram juntas (ex.: várias queries React Query na mesma tela). */
const refreshInFlight = new Map<AuthScope, Promise<boolean>>();

function refreshSession(scope: AuthScope): Promise<boolean> {
  const existing = refreshInFlight.get(scope);
  if (existing) return existing;

  const promise = fetch(`${API_URL}${REFRESH_PATH[scope]}`, { method: "POST", credentials: "include" })
    .then((res) => res.ok)
    .catch(() => false)
    .finally(() => refreshInFlight.delete(scope));
  refreshInFlight.set(scope, promise);
  return promise;
}

/**
 * Cliente HTTP para a API (apps/api). `credentials: "include"` é o que faz
 * os cookies HttpOnly de sessão (setados pela API em outro domínio/porta em
 * dev) irem em toda requisição — a API já libera isso via CORS
 * (`enableCors({ credentials: true })`, ver apps/api/src/main.ts).
 *
 * Item 19 do documento de alterações ("sessões sem logout frequente"): o
 * access token dura só 15min (ver `TokenService`). Antes desta mudança um
 * 401 por token expirado derrubava o usuário na hora; agora, ao receber
 * 401 fora dos próprios endpoints de auth, tenta renovar a sessão via
 * refresh token (rota `/auth/<escopo>/refresh`, já existia no backend mas
 * nunca era chamada pelo frontend) e repete a requisição original uma vez.
 * Só sobra como logout de fato quando o refresh token também expirou/foi
 * revogado.
 */
export async function apiFetch<T = unknown>(path: string, init: RequestInit = {}, _retried = false): Promise<T> {
  const hasBody = init.body !== undefined;
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });

  if (res.status === 401 && !_retried && !path.startsWith("/auth/")) {
    const refreshed = await refreshSession(scopeFor(path));
    if (refreshed) {
      return apiFetch<T>(path, init, true);
    }
  }

  const text = await res.text();
  const body = text ? safeJsonParse(text) : undefined;

  if (!res.ok) {
    throw new ApiError(extractMessage(body, `Erro ${res.status}`), res.status, body);
  }

  return body as T;
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export function apiGet<T = unknown>(path: string): Promise<T> {
  return apiFetch<T>(path);
}

export function apiPost<T = unknown>(path: string, data?: unknown): Promise<T> {
  return apiFetch<T>(path, { method: "POST", ...(data !== undefined ? { body: JSON.stringify(data) } : {}) });
}

export function apiPatch<T = unknown>(path: string, data?: unknown): Promise<T> {
  return apiFetch<T>(path, { method: "PATCH", ...(data !== undefined ? { body: JSON.stringify(data) } : {}) });
}

export function apiDelete<T = unknown>(path: string): Promise<T> {
  return apiFetch<T>(path, { method: "DELETE" });
}

/**
 * Remove chaves com string vazia de um payload antes de enviar — campos
 * opcionais do backend (`@IsOptional() @IsEmail()` etc.) só pulam a
 * validação quando a chave está ausente, não quando o valor é `""` (um
 * input de formulário deixado em branco vira `""`, nunca `undefined`).
 */
export function omitEmptyStrings<T extends object>(input: T): Partial<T> {
  const result: Partial<T> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== "") {
      (result as Record<string, unknown>)[key] = value;
    }
  }
  return result;
}
