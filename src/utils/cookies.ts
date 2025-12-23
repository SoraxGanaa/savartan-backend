import { isProd } from "../config";

export const REFRESH_COOKIE_NAME = "refresh_token";

export function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: isProd,          // must be true in production https
    sameSite: "lax" as const,
    path: "/auth/refresh"
  };
}
