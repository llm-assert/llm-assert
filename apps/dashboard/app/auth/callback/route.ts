import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";
import { validateNextUrl } from "@/lib/utils";

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
  const next = validateNextUrl(searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/error?code=invalid_code`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("[auth/callback]", {
      code: error.code,
      message: error.message,
    });
    const errorCode = error.code ?? "unknown";
    return NextResponse.redirect(
      `${origin}/auth/error?code=${encodeURIComponent(errorCode)}`,
    );
  }

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
