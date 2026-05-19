import { NextRequest, NextResponse } from "next/server";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 يوم

function setAuthCookie(response: NextResponse, name: string, value: string | null | undefined) {
  if (!value) return;
  response.cookies.set(name, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });
}

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const response = NextResponse.next();

  if (pathname.startsWith("/mandoub")) {
    setAuthCookie(response, "mandoub_c", searchParams.get("c"));
    setAuthCookie(response, "mandoub_s", searchParams.get("s"));
    setAuthCookie(response, "mandoub_exp", searchParams.get("exp"));
  }

  if (pathname.startsWith("/preparer")) {
    setAuthCookie(response, "preparer_p", searchParams.get("p"));
    setAuthCookie(response, "preparer_s", searchParams.get("s"));
    setAuthCookie(response, "preparer_exp", searchParams.get("exp"));
  }

  return response;
}

export const config = {
  matcher: ["/mandoub/:path*", "/preparer/:path*"],
};
