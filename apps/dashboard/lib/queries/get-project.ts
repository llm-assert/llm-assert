import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export const getProject = cache(async (slug: string) => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, slug, description")
    .eq("slug", slug)
    .eq("user_id", user.id)
    .single();

  return project;
});
