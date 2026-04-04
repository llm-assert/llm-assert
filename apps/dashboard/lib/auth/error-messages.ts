export interface AuthErrorCta {
  label: string;
  href: string;
}

export interface AuthErrorConfig {
  title: string;
  message: string;
  cta: AuthErrorCta;
  secondaryCta?: AuthErrorCta;
}

const AUTH_ERROR_CONFIG: Record<string, AuthErrorConfig> = {
  invalid_code: {
    title: "Invalid Sign-In Link",
    message:
      "The sign-in link is invalid or has already been used. Please request a new one.",
    cta: { label: "Back to Sign In", href: "/sign-in" },
  },
  expired_code: {
    title: "Link Expired",
    message: "Your sign-in link has expired. Please try again.",
    cta: { label: "Back to Sign In", href: "/sign-in" },
  },
  access_denied: {
    title: "Permission Required",
    message:
      "GitHub sign-in requires granting the requested permissions. You can try again or use email instead.",
    cta: { label: "Try Again with GitHub", href: "/sign-in" },
    secondaryCta: { label: "Sign In with Email", href: "/sign-in" },
  },
  session_expired: {
    title: "Session Expired",
    message: "Your session has ended. Please sign in again to continue.",
    cta: { label: "Sign In", href: "/sign-in" },
  },
  email_not_confirmed: {
    title: "Email Not Confirmed",
    message:
      "Please check your inbox and click the confirmation link before signing in.",
    cta: { label: "Back to Sign In", href: "/sign-in" },
  },
  provider_error: {
    title: "Provider Unavailable",
    message:
      "The authentication provider is temporarily unavailable. Try signing in with email instead.",
    cta: { label: "Sign In with Email", href: "/sign-in" },
  },
  unknown: {
    title: "Authentication Failed",
    message: "Something went wrong during sign-in. Please try again.",
    cta: { label: "Back to Sign In", href: "/sign-in" },
  },
};

export function getAuthErrorConfig(code: string | undefined): AuthErrorConfig {
  if (!code) return AUTH_ERROR_CONFIG.unknown;
  return AUTH_ERROR_CONFIG[code] ?? AUTH_ERROR_CONFIG.unknown;
}
