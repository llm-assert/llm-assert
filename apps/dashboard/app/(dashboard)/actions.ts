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

export type CreateProjectState = {
  error?:
    | "unauthorized"
    | "invalid_name"
    | "invalid_slug"
    | "slug_taken"
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
    p_description: description,
    p_key_hash: key.hash,
    p_key_prefix: key.prefix,
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

  revalidatePath("/", "page");

  return {
    success: true,
    projectId: row.project_id,
    projectSlug: slug,
    rawKey: key.raw,
  };
}
