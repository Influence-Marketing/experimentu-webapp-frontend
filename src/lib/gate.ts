import { NextResponse } from "next/server";

export const GATE_COOKIE = "u_gate";
export const GATE_TOKEN = "granted-aug2026";

// A relative Location, which the browser resolves against the address it's actually on. Behind a
// reverse proxy (Forge's Nginx), request.url carries the app's internal host (0.0.0.0:3000), so an
// absolute URL built from it would send the guest there.
const seeOther = (path: string) => new NextResponse(null, { status: 303, headers: { Location: path } });

export async function handleGatePost(request: Request) {
  const form = await request.formData();
  const password = String(form.get("password") ?? "");
  const expected = process.env.GATE_PASSWORD ?? "UScore2026";

  if (password === expected) {
    const res = seeOther("/");
    res.cookies.set(GATE_COOKIE, GATE_TOKEN, {
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
    return res;
  }

  return seeOther("/gate?error=1");
}
