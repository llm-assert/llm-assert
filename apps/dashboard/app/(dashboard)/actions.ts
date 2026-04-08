"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { generateApiKey } from "@/lib/api-keys";
import { validateSlug } from "@/lib/slugify";

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/sign-in");
}

export async function dismissOnboardingAction() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return;
  }

  const { error } = await supabase.auth.updateUser({
    data: { onboarding_dismissed: true },
  });

  if (error) {
    console.error(
      "[onboarding/dismiss] system_error message=%s",
      error.message,
    );
    return;
  }

  revalidatePath("/", "page");
}

export type CreateProjectState = {
  error?:
    | "unauthorized"
    | "invalid_name"
    | "invalid_slug"
    | "slug_taken"
    | "project_limit_reached"
    | "unknown";
  slugError?: string;
  success?: boolean;
  projectId?: string;
  projectSlug?: string;
  rawKey?: string;
};

export async function createProjectAction(
  _prevState: CreateProjectState,
  formData: FormData,
): Promise<CreateProjectState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "unauthorized" };
  }

  // UX guard only — the RPC is the security boundary
  const supabaseForCount = await createClient();
  const [{ count: projectCount }, { data: sub }] = await Promise.all([
    supabaseForCount
      .from("projects")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id),
    supabaseForCount
      .from("subscriptions")
      .select("project_limit, plan")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);
  const limit = sub?.project_limit ?? 1;
  if (limit >= 0 && (projectCount ?? 0) >= limit) {
    console.error(
      JSON.stringify({
        source: "projects/create",
        event: "quota_exceeded",
        user_id: user.id,
        plan: sub?.plan ?? "unknown",
        projects_used: projectCount ?? 0,
        project_limit: limit,
      }),
    );
    return { error: "project_limit_reached" };
  }

  const name = (formData.get("name") as string | null)?.trim() ?? "";
  const slug = (formData.get("slug") as string | null)?.trim() ?? "";
  const description =
    (formData.get("description") as string | null)?.trim() || null;

  if (!name || name.length > 100) {
    return { error: "invalid_name" };
  }

  const slugError = validateSlug(slug);
  if (slugError) {
    return { error: "invalid_slug", slugError };
  }

  const key = generateApiKey();

  const { data, error } = await supabase.rpc("create_project_with_key", {
    p_user_id: user.id,
    p_name: name,
    p_slug: slug,
    p_key_hash: key.hash,
    p_key_prefix: key.prefix,
    p_description: description,
  });

  if (error) {
    console.error(
      "[projects/create] system_error slug=%s code=%s message=%s",
      slug,
      error.code,
      error.message,
    );
    return { error: "unknown" };
  }

  const row = Array.isArray(data) ? data[0] : data;

  if (row?.status === "slug_taken") {
    return { error: "slug_taken" };
  }

  if (row?.status === "quota_exceeded") {
    return { error: "project_limit_reached" };
  }

  if (row?.status === "no_subscription") {
    return { error: "unauthorized" };
  }

  revalidatePath("/", "page");

  console.error(
    JSON.stringify({
      source: "projects/create",
      event: "created",
      user_id: user.id,
      project_id: row.project_id,
    }),
  );

  return {
    success: true,
    projectId: row.project_id,
    projectSlug: slug,
    rawKey: key.raw,
  };
}
