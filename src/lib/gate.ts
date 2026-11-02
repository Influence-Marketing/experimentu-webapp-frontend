import { NextResponse } from "next/server";

export const GATE_COOKIE = "u_gate";
export const GATE_TOKEN = "granted-aug2026";

export async function handleGatePost(request: Request) {
  const form = await request.formData();
  const password = String(form.get("password") ?? "");
  const expected = process.env.GATE_PASSWORD ?? "UScore2026";
  // Relative Location: behind a proxy request.url is the internal host (0.0.0.0:3000).
  const redirect = (location: string) =>
    new NextResponse(null, { status: 303, headers: { Location: location } });

  if (password === expected) {
    const res = redirect("/");
    res.cookies.set(GATE_COOKIE, GATE_TOKEN, {
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
    return res;
  }

  return redirect("/gate?error=1");
}
