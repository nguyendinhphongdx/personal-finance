import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isPublic = pathname.startsWith("/login") || pathname.startsWith("/register") || pathname.startsWith("/api/auth");

  // Check for session token (NextAuth v5 stores in cookie)
  const token = req.cookies.get("authjs.session-token") ?? req.cookies.get("__Secure-authjs.session-token");

  if (!token && !isPublic) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (token && (pathname === "/login" || pathname === "/register")) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|static|favicon.ico|api/auth).*)"],
};
