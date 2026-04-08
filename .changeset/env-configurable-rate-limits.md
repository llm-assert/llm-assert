---
"@llmassert/playwright": minor
---

Make judge rate-limit parameters configurable via environment variables

Rate-limit defaults (burst capacity, requests per minute, backoff base delay, max 429 retries) are now read from `LLMASSERT_*` environment variables instead of being hardcoded. This keeps sensitive tuning parameters out of committed source while maintaining backward compatibility — if the env vars are unset, the same defaults apply.
