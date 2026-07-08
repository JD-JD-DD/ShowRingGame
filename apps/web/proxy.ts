import { NextRequest, NextResponse } from "next/server";
import {
  decodeSessionToken,
  SESSION_COOKIE_NAME
} from "@/lib/sessionToken";

const ANONYMOUS_ROUTES = new Set([
  "/faq",
  "/guide",
  "/start-up-guide",
  "/login",
  "/signup",
  "/account-closed",
  "/forgot-password",
  "/reset-password"
]);

function isAnonymousRoute(pathname: string): boolean {
  return (
    ANONYMOUS_ROUTES.has(pathname) ||
    pathname.startsWith("/guide/") ||
    pathname.startsWith("/start-up-guide/")
  );
}

/**
 * Game content belongs to registered, logged-in players. Authentication pages
 * remain public so a player can create or recover an account.
 */
export function proxy(request: NextRequest) {
  if (isAnonymousRoute(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (token && decodeSessionToken(token)) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set(
    "next",
    `${request.nextUrl.pathname}${request.nextUrl.search}`
  );
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|.*\\..*).*)"]
};
