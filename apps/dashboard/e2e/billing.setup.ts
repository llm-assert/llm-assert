import { createClient } from "@supabase/supabase-js";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required env var: ${name}. See apps/dashboard/.env.example`,
    );
  }
  return value;
}

function getAdmin() {
  return createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

async function getUserId(email: string): Promise<string> {
  const admin = getAdmin();
  const { data } = await admin.auth.admin.listUsers();
  const user = data?.users.find((u) => u.email === email);
  if (!user) throw new Error(`Test user ${email} not found`);
  return user.id;
}

export async function seedPastDue(email: string): Promise<void> {
  const userId = await getUserId(email);
  const admin = getAdmin();
  await admin
    .from("subscriptions")
    .update({ status: "past_due" })
    .eq("user_id", userId);
}

export async function seedQuotaWarning(
  email: string,
  used: number,
  limit: number,
): Promise<void> {
  const userId = await getUserId(email);
  const admin = getAdmin();
  await admin
    .from("subscriptions")
    .update({ evaluations_used: used, evaluation_limit: limit })
    .eq("user_id", userId);
}

export async function seedQuotaExceeded(email: string): Promise<void> {
  const userId = await getUserId(email);
  const admin = getAdmin();
  // Read the current limit, then set used = limit
  const { data } = await admin
    .from("subscriptions")
    .select("evaluation_limit")
    .eq("user_id", userId)
    .single();
  const limit = data?.evaluation_limit ?? 100;
  await admin
    .from("subscriptions")
    .update({ evaluations_used: limit })
    .eq("user_id", userId);
}

export async function resetSubscription(email: string): Promise<void> {
  const userId = await getUserId(email);
  const admin = getAdmin();
  await admin
    .from("subscriptions")
    .update({ status: "active", evaluations_used: 0 })
    .eq("user_id", userId);
}
