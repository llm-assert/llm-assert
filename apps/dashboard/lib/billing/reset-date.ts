/**
 * Compute the next quota reset date.
 * Free tier: first day of next calendar month (UTC).
 * Paid tiers: current_period_end from Stripe.
 *
 * @param now - Optional anchor date for testability; defaults to current time.
 */
export function computeNextResetDate(
  plan: string,
  currentPeriodEnd: string | null,
  now: Date = new Date(),
): string | null {
  if (plan === "free") {
    const year =
      now.getUTCMonth() === 11
        ? now.getUTCFullYear() + 1
        : now.getUTCFullYear();
    const month = now.getUTCMonth() === 11 ? 0 : now.getUTCMonth() + 1;
    return new Date(Date.UTC(year, month, 1)).toISOString();
  }
  return currentPeriodEnd;
}
