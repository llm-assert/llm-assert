import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Validates a `next` URL parameter to prevent open redirects.
 * Only allows relative paths starting with `/`.
 * Rejects protocol-relative (`//`), absolute (`https://`), and
 * backslash-based (`/\`) bypass attempts.
 * Returns `/dashboard` as a safe fallback for invalid or missing values.
 */
export function validateNextUrl(next: string | null): string {
  if (!next) return "/dashboard";
  if (!next.startsWith("/") || next.startsWith("//")) return "/dashboard";
  // Reject backslash (some browsers normalise /\ to //) and embedded protocols
  if (next.includes("\\") || next.includes("://")) return "/dashboard";
  return next;
}
