"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, getMutationRateLimitConfig } from "@/lib/rate-limit";

const ASSERTION_TYPES = [
  "groundedness",
  "pii",
  "sentiment",
  "schema",
  "fuzzy",
] as const;

const thresholdValue = z.coerce
  .number()
  .min(0, "Threshold must be at least 0")
  .max(1, "Threshold must be at most 1");

const SaveThresholdsSchema = z.object({
  projectId: z.string().uuid("Invalid project ID"),
  groundedness: thresholdValue,
  pii: thresholdValue,
  sentiment: thresholdValue,
  schema: thresholdValue,
  fuzzy: thresholdValue,
});

export type SaveThresholdsState = {
  error?:
    | "unauthorized"
    | "rate_limited"
    | "project_not_found"
    | "validation_failed"
    | "unknown";
  success?: boolean;
};

export async function saveThresholdsAction(
  _prevState: SaveThresholdsState,
  formData: FormData,
): Promise<SaveThresholdsState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "unauthorized" };
  }

  const rl = await checkRateLimit(`mutation:threshold:${user.id}`, getMutationRateLimitConfig("threshold"));
  if (rl.limited) {
    return { error: "rate_limited" };
  }

  const parsed = SaveThresholdsSchema.safeParse({
    projectId: formData.get("projectId"),
    groundedness: formData.get("groundedness"),
    pii: formData.get("pii"),
    sentiment: formData.get("sentiment"),
    schema: formData.get("schema"),
    fuzzy: formData.get("fuzzy"),
  });

  if (!parsed.success) {
    return { error: "validation_failed" };
  }

  const { projectId, ...thresholds } = parsed.data;

  // Validate project ownership (RLS ensures only user's projects are visible)
  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .single();

  if (!project) {
    return { error: "project_not_found" };
  }

  // Upsert all 5 threshold rows (idempotent)
  const rows = ASSERTION_TYPES.map((type) => ({
    user_id: user.id,
    project_id: projectId,
    assertion_type: type,
    pass_threshold: thresholds[type],
  }));

  const { error } = await supabase
    .from("thresholds")
    .upsert(rows, { onConflict: "project_id,assertion_type" });

  if (error) {
    console.error(
      "[thresholds/save] system_error code=%s message=%s",
      error.code,
      error.message,
    );
    return { error: "unknown" };
  }

  revalidatePath("/settings/thresholds");
  return { success: true };
}
