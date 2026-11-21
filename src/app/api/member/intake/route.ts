import { NextResponse } from "next/server";
import { memberBackendFetch, memberSameOrigin, PRIVATE_HEADERS } from "@/lib/member-auth-server";

export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  if (!memberSameOrigin(request)) return NextResponse.json({ message: "Please reopen U Score from your member hub." }, { status: 403, headers: PRIVATE_HEADERS });
  if (Number(request.headers.get("content-length") || 0) > 16384) return NextResponse.json({}, { status: 413, headers: PRIVATE_HEADERS });
  try {
    const body = await request.text();
    if (body.length > 16384) return NextResponse.json({}, { status: 413, headers: PRIVATE_HEADERS });
    const upstream = await memberBackendFetch("/api/member/intake", { method: "POST", headers: { "Content-Type": "application/json" }, body });
    if (!upstream) return NextResponse.json({ message: "Please reconnect your member account." }, { status: 401, headers: PRIVATE_HEADERS });
    return NextResponse.json(await upstream.json(), { status: upstream.status, headers: PRIVATE_HEADERS });
  } catch {
    return NextResponse.json({ message: "We couldn’t save your intake. Please try again shortly." }, { status: 503, headers: PRIVATE_HEADERS });
  }
}
