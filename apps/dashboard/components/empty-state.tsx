import { FolderKanban } from "lucide-react";
import { CreateProjectDialog } from "@/components/create-project-dialog";

export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-lg bg-muted">
        <FolderKanban className="size-6 text-muted-foreground" />
      </div>
      <h2 className="mt-4 text-lg font-semibold">No projects yet</h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Create your first project to start tracking LLM assertion results.
      </p>
      <div className="mt-6">
        <CreateProjectDialog />
      </div>
    </div>
  );
}
