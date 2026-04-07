---
"@llmassert/playwright": minor
---

Add quota exhaustion UX for free tier users

- Reporter detects HTTP 429 QUOTA_EXCEEDED and emits human-readable message with plan, reset date, and upgrade URL (instead of raw JSON)
- New `onQuotaExhausted` config option (`'warn'` | `'fail'`) to control CI behavior on quota exhaustion
- Reporter stops retrying after 429 and skips remaining batches
- Structured `reporter.quota_exceeded` log event for machine parsing
- New `QuotaExceededInfo` type exported from `@llmassert/playwright`
