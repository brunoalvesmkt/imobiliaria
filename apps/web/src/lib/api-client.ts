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

/**
 * Cliente HTTP para a API (apps/api). `credentials: "include"` é o que faz
 * os cookies HttpOnly de sessão (setados pela API em outro domínio/porta em
 * dev) irem em toda requisição — a API já libera isso via CORS
 * (`enableCors({ credentials: true })`, ver apps/api/src/main.ts).
 */
export async function apiFetch<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const hasBody = init.body !== undefined;
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });

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
