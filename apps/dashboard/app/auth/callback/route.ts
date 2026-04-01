import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";

/**
 * Derive the allowed host for redirect validation.
 * Fallback chain: NEXT_PUBLIC_APP_URL → VERCEL_URL → localhost.
 * VERCEL_URL does NOT include the protocol — we prepend https://.
 */
function getAllowedHost(): string {
  return new URL(publicEnv.NEXT_PUBLIC_APP_URL).host;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  let next = searchParams.get("next") ?? "/";

  // Open redirect protection: only allow relative paths that don't start
  // with // (protocol-relative URLs that browsers interpret as external).
  if (!next.startsWith("/") || next.startsWith("//")) {
    next = "/";
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const forwardedHost = request.headers.get("x-forwarded-host");
      const isLocalEnv = process.env.NODE_ENV === "development";

      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`);
      } else if (forwardedHost) {
        // Validate forwarded host against the derived app URL to
        // prevent host header injection redirecting to attacker domains.
        const allowedHost = getAllowedHost();

        if (forwardedHost === allowedHost) {
          return NextResponse.redirect(`https://${forwardedHost}${next}`);
        }
        return NextResponse.redirect(`${origin}${next}`);
      } else {
        return NextResponse.redirect(`${origin}${next}`);
      }
    }
  }

  // No code or exchange failed — redirect to sign-in with error hint
  return NextResponse.redirect(`${origin}/sign-in`);
}
