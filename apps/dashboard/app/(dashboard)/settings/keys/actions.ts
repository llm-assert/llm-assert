"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { generateApiKey } from "@/lib/api-keys";

const MAX_KEYS_PER_PROJECT = 10;

const CreateKeySchema = z.object({
  projectId: z.string().uuid("Invalid project ID"),
  label: z
    .string()
    .trim()
    .min(1, "Label is required")
    .max(100, "Label must be 100 characters or less"),
});

// ── Create API Key ─────────────────────────────────────────────

export type CreateApiKeyState = {
  error?:
    | "unauthorized"
    | "invalid_label"
    | "project_not_found"
    | "key_limit_reached"
    | "unknown";
  success?: boolean;
  rawKey?: string;
  keyPrefix?: string;
};

const initialCreateState: CreateApiKeyState = {};

export { initialCreateState };

export async function createApiKeyAction(
  _prevState: CreateApiKeyState,
  formData: FormData,
): Promise<CreateApiKeyState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "unauthorized" };
  }

  const parsed = CreateKeySchema.safeParse({
    projectId: formData.get("projectId"),
    label: formData.get("label"),
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    if (fieldErrors.label) return { error: "invalid_label" };
    return { error: "project_not_found" };
  }

  const { projectId, label } = parsed.data;

  // Validate project ownership (RLS ensures only user's projects are visible)
  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .single();

  if (!project) {
    return { error: "project_not_found" };
  }

  // Check per-project active key cap
  const { count } = await supabase
    .from("api_keys")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId)
    .is("revoked_at", null);

  if (count !== null && count >= MAX_KEYS_PER_PROJECT) {
    return { error: "key_limit_reached" };
  }

  // Generate key and insert
  const key = generateApiKey();

  const { error } = await supabase.from("api_keys").insert({
    user_id: user.id,
    project_id: projectId,
    key_hash: key.hash,
    key_prefix: key.prefix,
    label,
  });

  // Handle key_hash unique violation (23505) — regenerate and retry once
  if (error?.code === "23505") {
    const retryKey = generateApiKey();
    const { error: retryError } = await supabase.from("api_keys").insert({
      user_id: user.id,
      project_id: projectId,
      key_hash: retryKey.hash,
      key_prefix: retryKey.prefix,
      label,
    });

    if (retryError) {
      console.error(
        "[api-keys/create] system_error code=%s message=%s",
        retryError.code,
        retryError.message,
      );
      return { error: "unknown" };
    }

    revalidatePath("/settings/keys");
    return { success: true, rawKey: retryKey.raw, keyPrefix: retryKey.prefix };
  }

  if (error) {
    console.error(
      "[api-keys/create] system_error code=%s message=%s",
      error.code,
      error.message,
    );
    return { error: "unknown" };
  }

  revalidatePath("/settings/keys");
  return { success: true, rawKey: key.raw, keyPrefix: key.prefix };
}

// ── Revoke API Key ─────────────────────────────────────────────

export type RevokeApiKeyState = {
  error?: "unauthorized" | "not_found" | "unknown";
  success?: boolean;
};

export async function revokeApiKeyAction(
  keyId: string,
): Promise<RevokeApiKeyState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "unauthorized" };
  }

  // Pre-check: SELECT the key to disambiguate "not found / not owned"
  // from "already revoked". RLS filters to the user's own keys only.
  const { data: existing } = await supabase
    .from("api_keys")
    .select("id, revoked_at")
    .eq("id", keyId)
    .single();

  if (!existing) {
    return { error: "not_found" };
  }

  // Already revoked — idempotent success
  if (existing.revoked_at !== null) {
    return { success: true };
  }

  const { error } = await supabase
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", keyId)
    .is("revoked_at", null);

  if (error) {
    console.error(
      "[api-keys/revoke] system_error code=%s message=%s",
      error.code,
      error.message,
    );
    return { error: "unknown" };
  }

  revalidatePath("/settings/keys");
  return { success: true };
}
