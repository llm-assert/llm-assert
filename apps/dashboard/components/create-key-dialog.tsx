"use client";

import {
  useActionState,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { KeyReveal } from "@/components/key-reveal";
import {
  createApiKeyAction,
  initialCreateState,
} from "@/app/(dashboard)/settings/keys/actions";

interface Project {
  id: string;
  name: string;
  slug: string;
}

export function CreateKeyDialog({ projects }: { projects: Project[] }) {
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [state, formAction, pending] = useActionState(
    createApiKeyAction,
    initialCreateState,
  );
  const labelRef = useRef<HTMLInputElement>(null);

  const isKeyReveal = state.success && state.rawKey;
  const hasProjects = projects.length > 0;

  // Get the slug of the selected project for KeyReveal
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setFormKey((k) => k + 1);
      setSelectedProjectId("");
    }
  }, []);

  // Focus label input when dialog opens
  useEffect(() => {
    if (open && !isKeyReveal) {
      setTimeout(() => labelRef.current?.focus(), 0);
    }
  }, [open, isKeyReveal]);

  const trigger = hasProjects ? (
    <DialogTrigger asChild>
      <Button size="sm">
        <Plus className="size-4" />
        New API Key
      </Button>
    </DialogTrigger>
  ) : (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0}>
          <Button size="sm" disabled>
            <Plus className="size-4" />
            New API Key
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent>Create a project first</TooltipContent>
    </Tooltip>
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {trigger}
      <DialogContent
        key={formKey}
        showCloseButton={!isKeyReveal}
        onInteractOutside={isKeyReveal ? (e) => e.preventDefault() : undefined}
        onEscapeKeyDown={isKeyReveal ? (e) => e.preventDefault() : undefined}
      >
        {isKeyReveal ? (
          <KeyReveal
            rawKey={state.rawKey!}
            projectSlug={selectedProject?.slug ?? ""}
            onDone={() => handleOpenChange(false)}
          />
        ) : (
          <form action={formAction}>
            <DialogHeader>
              <DialogTitle>New API Key</DialogTitle>
              <DialogDescription>
                Create an API key for your Playwright reporter to send test
                results.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label id="project-label">
                  Project <span className="text-destructive">*</span>
                </Label>
                <Select
                  name="projectId"
                  required
                  value={selectedProjectId}
                  onValueChange={setSelectedProjectId}
                >
                  <SelectTrigger aria-labelledby="project-label">
                    <SelectValue placeholder="Select a project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {state.error === "project_not_found" && (
                  <p role="alert" className="text-sm text-destructive">
                    Project not found. Please select a valid project.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="key-label">
                  Label <span className="text-destructive">*</span>
                </Label>
                <Input
                  ref={labelRef}
                  id="key-label"
                  name="label"
                  placeholder="e.g., ci-production"
                  required
                  aria-required="true"
                  maxLength={100}
                />
                {state.error === "invalid_label" && (
                  <p role="alert" className="text-sm text-destructive">
                    Label is required (max 100 characters).
                  </p>
                )}
              </div>

              {state.error === "key_limit_reached" && (
                <p role="alert" className="text-sm text-destructive">
                  This project has reached the maximum of 10 active keys. Revoke
                  an existing key first.
                </p>
              )}

              {state.error === "unknown" && (
                <p role="alert" className="text-sm text-destructive">
                  Something went wrong. Please try again.
                </p>
              )}
            </div>

            <DialogFooter className="mt-6">
              <Button type="submit" disabled={pending || !selectedProjectId}>
                {pending && <Loader2 className="size-4 animate-spin" />}
                Create Key
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
