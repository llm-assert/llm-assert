import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export const getProject = cache(async (slug: string, userId: string) => {
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, slug, description")
    .eq("slug", slug)
    .eq("user_id", userId)
    .single();

  return project;
});
