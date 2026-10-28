import { NextResponse, type NextRequest } from "next/server";
import { updateSession, withSessionCookies } from "@/lib/supabase/proxy";

// Refreshes the Supabase session on every request, then applies optimistic
// redirects based on whether a session exists. The real authorization happens
// in the Data Access Layer (lib/auth/dal.ts) and in the database (RLS).

const PUBLIC_PATHS = ["/login", "/no-access", "/auth/signout"];
const PUBLIC_PREFIXES = ["/dev/"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.includes(pathname) || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

export async function proxy(request: NextRequest) {
  const { response, signedIn } = await updateSession(request);
  const { pathname, search } = request.nextUrl;
  const redirectTo = (path: string) => withSessionCookies(response, NextResponse.redirect(new URL(path, request.url)));

  if (pathname === "/") return redirectTo(signedIn ? "/dashboard" : "/login");
  if (pathname === "/login" && signedIn) return redirectTo("/dashboard");
  if (!isPublic(pathname) && !signedIn) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname + search);
    return withSessionCookies(response, NextResponse.redirect(loginUrl));
  }
  return response;
}

export const config = {
  // Skip Next internals, the generated home-screen icon, and any path with a
  // file extension (static assets).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|apple-icon|.*\\..*).*)"],
};
