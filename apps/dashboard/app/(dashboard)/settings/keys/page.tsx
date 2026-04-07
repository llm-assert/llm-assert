import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ApiKeysTable } from "@/components/api-keys-table";
import { CreateKeyDialog } from "@/components/create-key-dialog";

export default async function ApiKeysPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  // Fetch all keys with project name/slug via PostgREST embedded join
  const { data: keys } = await supabase
    .from("api_keys")
    .select(
      "id, key_prefix, label, last_used_at, created_at, revoked_at, project_id, projects(name, slug)",
    )
    // RLS perf hint — not a security boundary (see CLAUDE.md)
    .eq("user_id", user.id)
    .order("revoked_at", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: false });

  // Fetch projects list for the create dialog project selector
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, slug")
    // RLS perf hint — not a security boundary (see CLAUDE.md)
    .eq("user_id", user.id)
    .order("name");

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">API Keys</h1>
        <CreateKeyDialog projects={projects ?? []} />
      </div>

      <ApiKeysTable keys={keys ?? []} />
    </div>
  );
}
