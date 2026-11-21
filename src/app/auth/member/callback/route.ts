import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { safeMemberReturnPath } from "@/lib/member-navigation";
import { cookieOptions, HANDOFF_COOKIE, MEMBER_COOKIE, memberAppOrigin, memberBackendUrl, PRIVATE_HEADERS } from "@/lib/member-auth-server";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const origin = memberAppOrigin();
  if (!origin) return NextResponse.json({ message: "Member sign-in is unavailable." }, { status: 503, headers: PRIVATE_HEADERS });
  const fail = () => {
    const response = NextResponse.redirect(new URL("/auth/member/error", origin), { headers: PRIVATE_HEADERS });
    response.cookies.set(HANDOFF_COOKIE, "", { ...cookieOptions, maxAge: 0 });
    return response;
  };
  const query = new URL(request.url).searchParams;
  const code = query.get("code") || "";
  const state = query.get("state") || "";
  try {
    const binding = JSON.parse((await cookies()).get(HANDOFF_COOKIE)?.value || "null");
    if (!binding || !/^[A-Za-z0-9_-]{43}$/.test(code) || !/^[A-Za-z0-9_-]{43}$/.test(state)
      || typeof binding.state !== "string" || binding.state.length !== state.length
      || typeof binding.verifier !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(binding.verifier)
      || typeof binding.expires !== "number" || binding.expires <= Date.now()
      || !timingSafeEqual(Buffer.from(binding.state), Buffer.from(state))) return fail();
    const upstream = await fetch(memberBackendUrl("/api/member/session"), {
      method: "POST", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15000),
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ code, code_verifier: binding.verifier }),
    });
    const session = await upstream.json();
    if (!upstream.ok || !/^[a-f0-9]{64}$/.test(session.session_token || "")) return fail();
    const lifetime = Math.min(14400, Math.floor((Date.parse(session.expires_at) - Date.now()) / 1000));
    if (!Number.isFinite(lifetime) || lifetime <= 0) return fail();
    const response = NextResponse.redirect(new URL(safeMemberReturnPath(binding.returnPath)+"?member=1&kiosk=0", origin), { headers: PRIVATE_HEADERS });
    response.cookies.set(MEMBER_COOKIE, session.session_token, { ...cookieOptions, maxAge: lifetime });
    response.cookies.set(HANDOFF_COOKIE, "", { ...cookieOptions, maxAge: 0 });
    return response;
  } catch { return fail(); }
}
