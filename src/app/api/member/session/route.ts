import { NextResponse } from "next/server";
import { cookieOptions, MEMBER_COOKIE, memberAppOrigin, memberBackendFetch, memberBackendReady, memberSameOrigin, PRIVATE_HEADERS } from "@/lib/member-auth-server";

export const dynamic = "force-dynamic";
export async function GET() {
  if (!memberAppOrigin()) return NextResponse.json({ member: null, sign_in_available: false }, { headers: PRIVATE_HEADERS });
  try {
    const upstream = await memberBackendFetch("/api/member/session");
    if (!upstream || upstream.status === 401) {
      const response = NextResponse.json({ member: null, sign_in_available: await memberBackendReady() }, { headers: PRIVATE_HEADERS });
      response.cookies.set(MEMBER_COOKIE, "", { ...cookieOptions, maxAge: 0 });
      return response;
    }
    if (!upstream.ok) throw new Error("Session unavailable");
    return NextResponse.json({ ...await upstream.json(), sign_in_available: true }, { headers: PRIVATE_HEADERS });
  } catch {
    return NextResponse.json({ message: "Your member session could not be checked. Please reconnect." }, { status: 503, headers: PRIVATE_HEADERS });
  }
}
export async function POST(request: Request) {
  if (!memberSameOrigin(request)) return NextResponse.json({ message: "Please sign out from U Score." }, { status: 403, headers: PRIVATE_HEADERS });
  try { await memberBackendFetch("/api/member/session", { method: "DELETE" }); } catch { /* Clear this browser even during a backend outage. */ }
  const response = NextResponse.redirect(new URL("/dashboard", "https://experimentu.joinajenda.com"), { status: 303, headers: PRIVATE_HEADERS });
  response.cookies.set(MEMBER_COOKIE, "", { ...cookieOptions, maxAge: 0 });
  return response;
}
