// IMPORTANT: This file MUST be named proxy.ts, NOT middleware.ts.
// Next.js 16 renamed the convention file from middleware.ts to proxy.ts.
// If this file is renamed to middleware.ts, it will be silently ignored
// and sessions will never be refreshed.

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { publicEnv } from "@/lib/env";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // FEAT-106: Redirect *.vercel.app to canonical custom domain in production.
  // Fires before Supabase session refresh to avoid wasted getUser() round-trips.
  // API paths are excluded — POST redirects break most HTTP clients.
  // Belt-and-suspenders: also configure Vercel Dashboard domain redirect for edge-level coverage.
  if (
    process.env.VERCEL_ENV === "production" &&
    !pathname.startsWith("/api/")
  ) {
    const hostname = request.headers.get("host") ?? "";
    if (hostname.endsWith(".vercel.app")) {
      try {
        const targetHost = new URL(publicEnv.NEXT_PUBLIC_APP_URL).hostname;
        // Safety: skip redirect if target is localhost or .vercel.app (loop prevention)
        if (
          !targetHost.includes("localhost") &&
          !targetHost.endsWith(".vercel.app")
        ) {
          const url = request.nextUrl.clone();
          url.host = targetHost;
          url.port = "";
          url.protocol = "https";
          return NextResponse.redirect(url, 301);
        }
      } catch {
        // Malformed NEXT_PUBLIC_APP_URL — fall through to normal proxy logic.
        // Log for operator visibility (appears in Vercel runtime logs).
        console.error(
          "[proxy] hostname redirect skipped: invalid NEXT_PUBLIC_APP_URL",
        );
      }
    }
  }

  // Skip auth for static SEO routes (high-frequency crawler endpoints)
  if (
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname === "/opengraph-image" ||
    pathname === "/twitter-image"
  ) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refresh the session. This calls getUser() which validates the JWT
  // server-side and refreshes the token if expired.
  // Do NOT use getSession() — it does not validate the JWT.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Public paths that don't require authentication
  const isPublicPath =
    pathname === "/" ||
    pathname.startsWith("/sign-in") ||
    pathname.startsWith("/sign-up") ||
    pathname.startsWith("/auth/callback") ||
    pathname.startsWith("/auth/error");
  const isApiPath = pathname.startsWith("/api/");

  // Redirect unauthenticated users to sign-in (defense in depth)
  if (!user && !isPublicPath && !isApiPath) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/sign-in";
    redirectUrl.searchParams.set("next", pathname);
    const redirectResponse = NextResponse.redirect(redirectUrl);
    // Preserve Supabase cookies on the redirect response
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value);
    });
    return redirectResponse;
  }

  // Redirect authenticated users away from auth pages to dashboard
  if (
    user &&
    (pathname.startsWith("/sign-in") || pathname.startsWith("/sign-up"))
  ) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/dashboard";
    redirectUrl.search = "";
    const redirectResponse = NextResponse.redirect(redirectUrl);
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value);
    });
    return redirectResponse;
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|auth/callback|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
