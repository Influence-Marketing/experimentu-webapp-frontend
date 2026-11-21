import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { safeMemberReturnPath } from "@/lib/member-navigation";
import { cookieOptions, HANDOFF_COOKIE, memberAppOrigin, PORTAL_ORIGIN, PRIVATE_HEADERS } from "@/lib/member-auth-server";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  if (!memberAppOrigin()) return NextResponse.json({ message: "Member sign-in is being prepared." }, { status: 503, headers: PRIVATE_HEADERS });
  const query = new URL(request.url).searchParams;
  let returnPath = safeMemberReturnPath(query.get("return_to"));
  if (!query.has("return_to")) {
    try {
      const pending = JSON.parse((await cookies()).get(HANDOFF_COOKIE)?.value || "null");
      if (pending && typeof pending.expires === "number" && pending.expires > Date.now()) returnPath = safeMemberReturnPath(pending.returnPath);
    } catch { /* A fresh attempt replaces an invalid or expired binding. */ }
  }
  const state = randomBytes(32).toString("base64url");
  const verifier = randomBytes(32).toString("base64url");
  const destination = new URL("/api/uscore/authorize", PORTAL_ORIGIN);
  destination.searchParams.set("state", state);
  destination.searchParams.set("code_challenge", createHash("sha256").update(verifier).digest("base64url"));
  const response = NextResponse.redirect(destination, { headers: PRIVATE_HEADERS });
  response.cookies.set(HANDOFF_COOKIE, JSON.stringify({ state, verifier, returnPath, expires: Date.now() + 300000 }), { ...cookieOptions, maxAge: 300 });
  return response;
}
