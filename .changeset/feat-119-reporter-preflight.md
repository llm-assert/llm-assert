---
"@llmassert/playwright": minor
---

Add pre-flight health check to reporter — validates API key, project slug, and quota status before judge calls run. New `preflight` config option (`'warn'` | `'fail'` | `false`), `preflightTimeout` option, and exported `preflightCheck()` function for `globalSetup` fail-fast.
