-- Stripe webhook event deduplication table.
-- Keyed on Stripe event.id to implement at-least-once idempotency.
-- Writes are service-role only (admin client in webhook handler).

create table stripe_webhook_events (
  event_id     text primary key,
  event_type   text not null,
  processed_at timestamptz not null default now()
);

alter table stripe_webhook_events enable row level security;
-- No user-facing policies — authenticated users cannot read or write this table.
-- Service-role admin client bypasses RLS for all webhook processing.
