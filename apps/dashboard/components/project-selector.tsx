"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface Project {
  id: string;
  name: string;
  slug: string;
}

export function ProjectSelector({
  projects,
  selectedSlug,
}: {
  projects: Project[];
  selectedSlug: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleChange(slug: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("project", slug);
    router.replace(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-3">
      <Label htmlFor="project-selector">Project</Label>
      <Select value={selectedSlug} onValueChange={handleChange}>
        <SelectTrigger id="project-selector" className="w-[220px]">
          <SelectValue placeholder="Select a project" />
        </SelectTrigger>
        <SelectContent>
          {projects.map((p) => (
            <SelectItem key={p.id} value={p.slug}>
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
