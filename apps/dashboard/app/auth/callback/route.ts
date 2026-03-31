import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
        // Validate forwarded host against the configured app URL to
        // prevent host header injection redirecting to attacker domains.
        const allowedHost = process.env.NEXT_PUBLIC_APP_URL
          ? new URL(process.env.NEXT_PUBLIC_APP_URL).host
          : null;

        if (allowedHost && forwardedHost === allowedHost) {
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
