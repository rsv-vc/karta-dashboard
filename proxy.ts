import { NextResponse, type NextRequest } from "next/server";
import { getUserById } from "@/data/mock-users";
import { SESSION_COOKIE, getSessionSecret, verifySessionToken } from "@/lib/auth/session-token";

// Optimistic route guard: redirects based on the session cookie alone. The real
// authorization happens in the Data Access Layer (lib/auth/dal.ts), close to the data.

const PUBLIC_PATHS = ["/login", "/no-access"];
const PUBLIC_PREFIXES = ["/dev/"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.includes(pathname) || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

/** Same checks as the DAL (signature, expiry, active user) so the two never disagree and loop. */
function hasValidSession(request: NextRequest): boolean {
  const session = verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value, getSessionSecret());
  if (!session) return false;
  return getUserById(session.userId)?.status === "active";
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const signedIn = hasValidSession(request);

  if (pathname === "/") {
    return NextResponse.redirect(new URL(signedIn ? "/dashboard" : "/login", request.url));
  }

  if (pathname === "/login" && signedIn) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (!isPublic(pathname) && !signedIn) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname + search);
    const response = NextResponse.redirect(loginUrl);
    // Clear a tampered or expired cookie so the browser stops sending it.
    if (request.cookies.has(SESSION_COOKIE)) response.cookies.delete(SESSION_COOKIE);
    return response;
  }

  return NextResponse.next();
}

export const config = {
  // Skip Next internals and any path with a file extension (static assets).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
