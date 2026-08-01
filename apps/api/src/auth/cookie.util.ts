import type { Response } from "express";

export const TENANT_ACCESS_COOKIE = "tenant_access_token";
export const TENANT_REFRESH_COOKIE = "tenant_refresh_token";
export const MASTER_ACCESS_COOKIE = "master_access_token";
export const MASTER_REFRESH_COOKIE = "master_refresh_token";
export const AFFILIATE_ACCESS_COOKIE = "affiliate_access_token";
export const AFFILIATE_REFRESH_COOKIE = "affiliate_refresh_token";
export const TENANT_2FA_CHALLENGE_COOKIE = "tenant_2fa_challenge";

const isProduction = process.env.NODE_ENV === "production";

// Sem isso, o cookie fica "host-only" — restrito exatamente ao host que o
// criou. Funciona em dev local por coincidência (api e web rodam ambos em
// "localhost", só em portas diferentes — cookie não é escopado por porta).
// Em produção, api/web ficam em subdomínios DIFERENTES (ex.:
// api.chatbot.agenciaclamber.com.br vs chatbot.agenciaclamber.com.br) — sem
// um domain explícito cobrindo os dois, o navegador nunca reenvia o cookie
// pro domínio do painel, e o middleware.ts (que roda no servidor do painel)
// nunca o vê. Bug real encontrado no primeiro deploy em VPS desta sessão.
// COOKIE_DOMAIN deve ser o domínio-pai comum aos dois (ex.:
// "chatbot.agenciaclamber.com.br", que cobre a si mesmo e o subdomínio
// "api.chatbot.agenciaclamber.com.br") — deixe vazio em dev.
const cookieDomain = process.env.COOKIE_DOMAIN || undefined;

/**
 * Mesmo parser de duração usado em `TokenService.getRefreshTokenTtlMs()` —
 * duplicado aqui porque este arquivo não é um provider Nest (lê
 * `process.env` direto, igual `isProduction`/`cookieDomain` acima) e não
 * tem acesso ao `ConfigService`.
 */
function parseDurationMs(raw: string | undefined, fallbackMs: number): number {
  if (!raw) return fallbackMs;
  const match = /^(\d+)([smhd])$/.exec(raw);
  if (!match) return fallbackMs;
  const [, amountRaw, unit] = match;
  const unitMs = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[unit as "s" | "m" | "h" | "d"];
  return Number(amountRaw) * unitMs;
}

// Item 19 do documento de alterações ("sessões sem logout frequente"),
// revisitado: mesmo com o middleware tentando refresh antes de redirecionar
// pro login, um access token de 15min gerava renovações frequentes o
// suficiente para expor uma corrida real entre o refresh disparado pelo
// middleware (a cada navegação) e o disparado pelo cliente (a cada 401) —
// os dois usando o mesmo refresh token rotativo (uso único), então quem
// perdesse a corrida recebia um refresh token já invalidado e caía pro
// login sozinho, mesmo com pouca inatividade. Alongar o access token reduz
// drasticamente a frequência de refresh (e logo a chance de corrida) sem
// abrir mão de expiração — а sessão deve permanecer aberta enquanto a aba
// estiver em uso, só encerrando de fato no logout manual ou após
// inatividade real (JWT_REFRESH_EXPIRES_IN).
const accessTokenTtlMs = parseDurationMs(process.env.JWT_ACCESS_EXPIRES_IN, 12 * 3_600_000);

const baseCookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: "strict" as const,
  path: "/",
  ...(cookieDomain ? { domain: cookieDomain } : {}),
};

export function setAuthCookies(
  res: Response,
  accessCookieName: string,
  accessToken: string,
  refreshCookieName: string,
  refreshToken: string,
  refreshTtlMs: number,
): void {
  res.cookie(accessCookieName, accessToken, { ...baseCookieOptions, maxAge: accessTokenTtlMs });
  res.cookie(refreshCookieName, refreshToken, { ...baseCookieOptions, maxAge: refreshTtlMs });
}

export function clearAuthCookies(res: Response, accessCookieName: string, refreshCookieName: string): void {
  res.clearCookie(accessCookieName, baseCookieOptions);
  res.clearCookie(refreshCookieName, baseCookieOptions);
}

export function setTwoFactorChallengeCookie(res: Response, token: string): void {
  res.cookie(TENANT_2FA_CHALLENGE_COOKIE, token, { ...baseCookieOptions, maxAge: 10 * 60 * 1000 });
}

export function clearTwoFactorChallengeCookie(res: Response): void {
  res.clearCookie(TENANT_2FA_CHALLENGE_COOKIE, baseCookieOptions);
}
