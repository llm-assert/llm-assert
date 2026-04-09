# CLAUDE.md

## Tech Stack

- **Next.js 16.2.1** (App Router) — dashboard at `apps/dashboard/`
- **Supabase** (`@supabase/ssr` v0.9.0, `@supabase/supabase-js` v2.100.1) — Auth + Postgres + RLS
- **Playwright** (`@playwright/test` v1.58.2) — assertion plugin at `packages/playwright/`
- **OpenAI** (`openai` v6.33.0) — judge model (GPT-5.4-mini primary)
- **Stripe** (`stripe` v21.0.0, API version `2026-03-25.dahlia`) — billing
- **tsup** v8.5.1 — bundler for `@llmassert/playwright` (CJS + ESM dual output)
- **npm** workspaces — monorepo manager

## Project Structure

```
packages/playwright/     # npm: @llmassert/playwright (type: module)
  src/assertions/        # 5 matchers: groundedness, pii, sentiment, schema, fuzzy
  src/judge/             # LLM judge client, prompts, provider abstraction
  src/reporter.ts        # Custom Playwright reporter → POST /api/ingest
  src/fixtures.ts        # test.extend fixtures
  src/types.ts           # Shared types
apps/dashboard/          # Next.js 16 analytics dashboard
  app/(auth)/            # Sign in/up routes (Supabase Auth)
  app/(dashboard)/       # Authenticated dashboard routes
  app/api/ingest/        # Reporter ingestion endpoint (API key auth)
  app/api/webhooks/      # Stripe webhook handler
  lib/supabase/          # Server + browser client factories
supabase/migrations/     # Postgres DDL with RLS
```

## Conventions

- All assertions return `{ pass: boolean; score: number; reasoning: string }` and support `.not`
- Judge calls go through the provider-agnostic client (`judge/client.ts`), never direct OpenAI SDK usage
- Fallback chain: GPT-5.4-mini → Claude Haiku → mark `inconclusive` (never `fail` on provider outage)
- Dashboard API routes: always call `supabase.auth.getUser()` first, filter queries by `user_id`
- Next.js 16: `await params`, `await cookies()`, `await headers()` — all request APIs are async
- Use `proxy.ts` not `middleware.ts` for auth session refresh
- Supabase: use `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (not anon key) with `@supabase/ssr`
- Stripe: use `request.text()` for raw webhook body, verify with `stripe.webhooks.constructEvent()`
- Use `data-testid="<component>-<element>"` on dashboard components for e2e test selectors (e.g., `stats-cards`, `run-row-{id}`, `eval-metadata-panel`)

## DO

- Use `@supabase/ssr` `createServerClient` / `createBrowserClient` (NOT deprecated `@supabase/auth-helpers-nextjs`)
- Wrap `auth.uid()` as `(select auth.uid())` in RLS policies and RPC ownership checks for performance
- Add `.eq("user_id", userId)` to authenticated dashboard queries as a planner hint (RLS remains the security boundary — the filter helps Postgres use the `user_id` index). Source `userId` from `supabase.auth.getUser()` only
- Use structured JSON response format in all judge prompts: `{"score": <number>, "reasoning": "<string>"}`
- Handle judge timeout (>10s) as `inconclusive`, not `fail`
- Use route groups `(auth)` and `(dashboard)` for layout separation
- Use Server Components by default, push `'use client'` as far down as possible
- Use `tsup` with `format: ['cjs', 'esm']` and `dts: true` for the plugin package

## DON'T

- Don't use `@vercel/postgres` or `@vercel/kv` — they are sunset
- Don't use `supabase.auth.getSession()` — use `supabase.auth.getUser()` instead
- Don't store API keys in plaintext — hash with SHA-256, store `key_hash` and `key_prefix`
- Don't use `bodyParser: false` — App Router doesn't need it, use `request.text()`
- Don't block the test suite on ingest failures — reporter uses `onError: 'warn'` by default
- Don't hardcode judge model names — use the configurable fallback chain
- Don't use snapshot tests
- Don't add `.eq("user_id")` to service_role/admin queries (ingest, webhooks, crons) — they bypass RLS intentionally

## Deployment

- Production deploys are **CI-gated**: pushes to `main` trigger a preview build via Vercel Git Integration, then the `promote` job in `ci.yml` promotes it to production after all CI jobs pass
- Preview deployments on PRs are automatic (not gated by CI)
- `llm-assert-docs` stays on automatic Vercel Git Integration (no CI gate)
- Emergency bypass: use the `Emergency Promote` workflow via GitHub Actions `workflow_dispatch` — requires a deployment URL and reason
- `VERCEL_TOKEN` is stored in the GitHub Environment `production` (project-scoped, branch-restricted to `main`)
- Vercel CLI is pinned at `vercel@50.42.0` in workflow files — update via Dependabot
