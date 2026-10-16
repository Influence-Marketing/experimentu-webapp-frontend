import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { GATE_COOKIE, GATE_TOKEN } from "@/lib/gate";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/gate" || pathname === "/_gate" || pathname === "/api/gate" || pathname === "/__gate") {
    return NextResponse.next();
  }

  if (request.cookies.get(GATE_COOKIE)?.value === GATE_TOKEN) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = "/gate";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/gate",
    "/_gate",
    "/__gate",
    "/api/gate",
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
