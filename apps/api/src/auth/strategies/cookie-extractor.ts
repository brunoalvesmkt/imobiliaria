import type { Request } from "express";
import type { JwtFromRequestFunction } from "passport-jwt";

export function cookieExtractor(cookieName: string): JwtFromRequestFunction {
  return (req: Request): string | null => {
    const cookies = (req as Request & { cookies?: Record<string, string> }).cookies;
    return cookies?.[cookieName] ?? null;
  };
}
