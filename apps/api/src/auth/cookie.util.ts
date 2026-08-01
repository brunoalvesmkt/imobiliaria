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
  res.cookie(accessCookieName, accessToken, { ...baseCookieOptions, maxAge: 15 * 60 * 1000 });
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
