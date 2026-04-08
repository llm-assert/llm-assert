---
"@llmassert/dashboard": patch
---

fix(webhooks): atomic dedup inside record_plan_transition RPC (SEC-41)

Moves the stripe_webhook_events dedup INSERT inside the record_plan_transition()
Postgres function so that dedup, subscription upsert, and audit insert are a
single transaction. If the RPC fails, the dedup row rolls back and Stripe
retries succeed — fixing a silent data-loss bug where events could be marked
"processed" without actually updating the subscription.
