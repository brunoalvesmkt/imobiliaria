import type { Response } from "express";

export const TENANT_ACCESS_COOKIE = "tenant_access_token";
export const TENANT_REFRESH_COOKIE = "tenant_refresh_token";
export const MASTER_ACCESS_COOKIE = "master_access_token";
export const MASTER_REFRESH_COOKIE = "master_refresh_token";
export const AFFILIATE_ACCESS_COOKIE = "affiliate_access_token";
export const AFFILIATE_REFRESH_COOKIE = "affiliate_refresh_token";

const isProduction = process.env.NODE_ENV === "production";

const baseCookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: "strict" as const,
  path: "/",
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
