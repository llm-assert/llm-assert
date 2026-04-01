import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/env.server";

// ---------------------------------------------------------------------------
// Supabase Admin Client — service_role key, bypasses RLS
// ---------------------------------------------------------------------------
//
// Uses `createClient` from `@supabase/supabase-js` (NOT `createServerClient`
// from `@supabase/ssr`). The SSR client threads cookies into the Authorization
// header, which overrides the service_role key and re-enables RLS enforcement
// even when the service_role key is provided. This is a documented Supabase
// gotcha for server-to-server clients.
//
// All three auth session options are disabled because:
// - persistSession: false  — no storage mechanism in serverless
// - autoRefreshToken: false — service_role keys don't expire
// - detectSessionInUrl: false — no browser redirect to detect
//
// Intended consumers: /api/ingest (reporter writes) and /api/webhooks/stripe
// (subscription lifecycle). Do not use for user-facing routes — those should
// use the cookie-based SSR client from ./server.ts which respects RLS.
// ---------------------------------------------------------------------------

/**
 * Create a Supabase admin client with explicit URL and service_role key.
 * Exported for testability — tests can call this directly without triggering
 * `server-only` or env validation.
 */
export function createAdminClient(
  url: string,
  serviceRoleKey: string,
): SupabaseClient {
  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

let _instance: SupabaseClient | null = null;

/**
 * Lazy singleton admin client for production use. Creates the instance on
 * first call using validated environment variables.
 */
export function supabaseAdmin(): SupabaseClient {
  if (!_instance) {
    _instance = createAdminClient(
      publicEnv.NEXT_PUBLIC_SUPABASE_URL,
      serverEnv.SUPABASE_SERVICE_ROLE_KEY,
    );
  }
  return _instance;
}
