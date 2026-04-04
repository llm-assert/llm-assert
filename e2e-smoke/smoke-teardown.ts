import { createClient } from "@supabase/supabase-js";
import { readFileSync, unlinkSync, existsSync } from "node:fs";
import path from "node:path";
import type { SmokeState } from "./smoke-setup";

const STATE_PATH = path.resolve(__dirname, ".smoke-state.json");

export default async function smokeTeardown() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.warn(
      "[smoke-teardown] Skipping cleanup — SUPABASE_SERVICE_ROLE_KEY not set. Test data may remain.",
    );
    return;
  }

  if (!existsSync(STATE_PATH)) {
    return;
  }

  let state: SmokeState;
  try {
    state = JSON.parse(readFileSync(STATE_PATH, "utf-8"));
  } catch {
    return;
  }

  const db = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Delete the project — cascades to api_keys, test_runs, evaluations
  const { error } = await db
    .from("projects")
    .delete()
    .eq("id", state.projectId);

  if (error) {
    console.warn(`[smoke-teardown] Failed to delete project: ${error.message}`);
  } else {
    console.info(`[smoke-teardown] Cleaned up project: ${state.projectSlug}`);
  }

  // Remove state file
  try {
    unlinkSync(STATE_PATH);
  } catch {
    // Ignore
  }
}
