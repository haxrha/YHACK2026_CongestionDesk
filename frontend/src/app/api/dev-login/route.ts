import { NextResponse } from "next/server";
import {
  DEV_SESSION_COOKIE,
  DEV_SESSION_VALUE,
} from "@/lib/devAuth";

export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  const res = NextResponse.redirect(new URL("/", origin));
  res.cookies.set(DEV_SESSION_COOKIE, DEV_SESSION_VALUE, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
