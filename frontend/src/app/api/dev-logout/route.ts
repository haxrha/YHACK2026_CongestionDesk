import { NextResponse } from "next/server";
import { DEV_SESSION_COOKIE } from "@/lib/devAuth";

export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  const res = NextResponse.redirect(new URL("/login", origin));
  res.cookies.set(DEV_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
