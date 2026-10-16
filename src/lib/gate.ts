import { NextResponse } from "next/server";

export const GATE_COOKIE = "u_gate";
export const GATE_TOKEN = "granted-aug2026";

export async function handleGatePost(request: Request) {
  const form = await request.formData();
  const password = String(form.get("password") ?? "");
  const expected = process.env.GATE_PASSWORD ?? "UScore2026";
  const origin = new URL(request.url).origin;

  if (password === expected) {
    const res = NextResponse.redirect(new URL("/", origin), 303);
    res.cookies.set(GATE_COOKIE, GATE_TOKEN, {
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
    return res;
  }

  return NextResponse.redirect(new URL("/gate?error=1", origin), 303);
}
