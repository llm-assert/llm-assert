# Contributing to llm-assert

Thanks for your interest in contributing! This guide covers the workflow for submitting changes.

## Development Setup

```bash
# Clone the repository
git clone https://github.com/llm-assert/llm-assert.git
cd llm-assert

# Install dependencies (this also sets up git hooks via husky)
pnpm install

# Build all packages
pnpm run build

# Run the dashboard locally
pnpm --filter @llmassert/dashboard dev
```

## Branch Naming

Create a branch from `main` using the format `<type>/<description>`:

```
feat/schema-assertion
fix/judge-timeout
docs/contributing-guide
refactor/reporter-batching
ci/add-test-job
```

## Commit Messages

We use [Conventional Commits](https://www.conventionalcommits.org/). Commit messages are validated automatically by a git hook.

### Format

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Types

`feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`

### Scopes

| Scope | Covers |
|-------|--------|
| `playwright` | `packages/playwright/` — assertions, types, fixtures |
| `judge` | `packages/playwright/src/judge/` — prompts, client, providers |
| `dashboard` | `apps/dashboard/` — pages, components, layouts |
| `db` | `supabase/migrations/` — schema, RLS policies |
| `ci` | `.github/workflows/`, CI configuration |
| `deps` | Dependency updates |

Scope is encouraged but not required. Commits without scope will show a warning.

### Examples

```
feat(playwright): add toxicity assertion type
fix(judge): handle timeout as inconclusive instead of fail
docs(dashboard): add API key management guide
ci: add commitlint validation job
chore(deps): update @playwright/test to 1.59
feat(playwright)!: rename toBeGroundedIn to toBeGrounded

BREAKING CHANGE: assertion method renamed for consistency
```

## Pull Request Process

1. Create a feature branch from `main`
2. Make your changes with conventional commits
3. Push your branch and open a PR against `main`
4. Wait for CI checks to pass (lint, typecheck, build, commitlint)
5. Address review feedback
6. Your PR will be squash-merged into `main`

All PRs are squash-merged to keep a clean linear history on `main`.

## What to Know

- **Judge prompt changes** (`packages/playwright/src/judge/`) are high-impact and affect evaluation scoring. These require careful review.
- **Database migrations** (`supabase/migrations/`) include RLS policies that are security-critical. One migration per feature branch.
- **The publish workflow** (`.github/workflows/publish.yml`) is protected by CODEOWNERS.
