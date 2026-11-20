import "server-only";
import { cookies } from "next/headers";

export const PORTAL_ORIGIN = "https://experimentu.joinajenda.com";
export const PRIVATE_HEADERS = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex" };
export const secureCookie = process.env.NODE_ENV === "production";
export const MEMBER_COOKIE = secureCookie ? "__Host-uscore-member" : "uscore-member";
export const HANDOFF_COOKIE = secureCookie ? "__Host-uscore-handoff" : "uscore-handoff";
export const cookieOptions = { httpOnly: true, secure: secureCookie, sameSite: "lax" as const, path: "/" };

export function memberAppOrigin() {
  if (process.env.USCORE_MEMBER_SSO_ENABLED !== "true") return null;
  try {
    const url = new URL(process.env.USCORE_APP_ORIGIN || "https://uscore.joinajenda.com");
    if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) return null;
    return url.origin;
  } catch { return null; }
}

export function memberBackendUrl(path: string) {
  const value = process.env.USCORE_API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!value) throw new Error("U Score API is not configured");
  const base = new URL(value);
  if (base.protocol !== "https:" || base.username || base.password) throw new Error("U Score API requires HTTPS");
  return new URL(path, base);
}

export async function memberBackendFetch(path: string, init: RequestInit = {}) {
  const token = (await cookies()).get(MEMBER_COOKIE)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  return fetch(memberBackendUrl(path), { ...init, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(12000),
    headers: { ...init.headers, Accept: "application/json", Authorization: `Bearer ${token}` } });
}

export function memberSameOrigin(request: Request) {
  const origin = memberAppOrigin();
  return origin !== null && request.headers.get("origin") === origin;
}
