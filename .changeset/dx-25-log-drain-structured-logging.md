---
"@llmassert/dashboard": patch
---

Add structured logging with pino for security-sensitive API routes

Introduces a shared pino logger module (`lib/logger.ts`) and migrates 5 route files from raw `console.*` calls to structured JSON logging:
- `api/ingest/route.ts` and `api/ingest/preflight/route.ts`
- `api/webhooks/stripe/route.ts`
- `api/cron/ghost-audit/route.ts`
- `api/cron/reconcile/route.ts`

Log output now includes structured fields (source, event type, context) for queryable log drain output. Sensitive data (API keys, raw Stripe events, user emails) is excluded from all log entries.

Also adds a non-blocking log drain health check to the CI promote job.
