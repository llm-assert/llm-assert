"use client";

import {
  useActionState,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { AlertCircle, Loader2, Plus } from "lucide-react";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { KeyReveal } from "@/components/key-reveal";
import {
  createProjectAction,
  type CreateProjectState,
} from "@/app/(dashboard)/actions";
import { nameToSlug } from "@/lib/slugify";

const initialState: CreateProjectState = {};

export function CreateProjectDialog({
  atProjectQuota,
}: {
  atProjectQuota?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [state, formAction, pending] = useActionState(
    createProjectAction,
    initialState,
  );
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [nameValue, setNameValue] = useState("");
  const [slugValue, setSlugValue] = useState("");
  const [descValue, setDescValue] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);

  const isKeyReveal = state.success && state.rawKey;

  // Auto-derive slug from name
  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const name = e.target.value;
      setNameValue(name);
      if (!slugManuallyEdited) {
        setSlugValue(nameToSlug(name));
      }
    },
    [slugManuallyEdited],
  );

  const handleSlugChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSlugManuallyEdited(true);
      setSlugValue(e.target.value);
    },
    [],
  );

  // Reset all state (including useActionState) when dialog closes.
  // Incrementing formKey forces React to remount the form, which
  // re-initialises useActionState with initialState — the only way
  // to clear stale error/success state from a previous submission.
  const handleOpenChange = useCallback((nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setFormKey((k) => k + 1);
      setNameValue("");
      setSlugValue("");
      setDescValue("");
      setSlugManuallyEdited(false);
    }
  }, []);

  // Focus name input when dialog opens in form mode
  useEffect(() => {
    if (open && !isKeyReveal) {
      setTimeout(() => nameRef.current?.focus(), 0);
    }
  }, [open, isKeyReveal]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {atProjectQuota ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={0} data-testid="create-project-trigger-disabled">
                <Button size="sm" disabled>
                  <Plus className="size-4" />
                  New Project
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p>
                You&apos;ve reached your plan&apos;s project limit.{" "}
                <Link
                  href="/settings/billing"
                  className="underline font-medium"
                >
                  Upgrade
                </Link>
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        <DialogTrigger asChild>
          <Button size="sm" data-testid="create-project-trigger">
            <Plus className="size-4" />
            New Project
          </Button>
        </DialogTrigger>
      )}
      <DialogContent
        key={formKey}
        showCloseButton={!isKeyReveal}
        onInteractOutside={isKeyReveal ? (e) => e.preventDefault() : undefined}
        onEscapeKeyDown={isKeyReveal ? (e) => e.preventDefault() : undefined}
      >
        {isKeyReveal ? (
          <KeyReveal
            rawKey={state.rawKey!}
            projectSlug={state.projectSlug!}
            onDone={() => handleOpenChange(false)}
          />
        ) : (
          <form action={formAction}>
            <DialogHeader>
              <DialogTitle>New Project</DialogTitle>
              <DialogDescription>
                Create a project to start tracking LLM assertion results.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="project-name">
                  Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  ref={nameRef}
                  id="project-name"
                  name="name"
                  placeholder="My Chatbot App"
                  required
                  aria-required="true"
                  value={nameValue}
                  onChange={handleNameChange}
                  maxLength={100}
                />
                {state.error === "invalid_name" && (
                  <p role="alert" className="text-sm text-destructive">
                    Name is required (max 100 characters).
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="project-slug">
                  Slug <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="project-slug"
                  name="slug"
                  placeholder="my-chatbot-app"
                  required
                  aria-required="true"
                  value={slugValue}
                  onChange={handleSlugChange}
                  maxLength={64}
                  className="font-mono"
                />
                {state.error === "slug_taken" && (
                  <p role="alert" className="text-sm text-destructive">
                    This slug is already taken. Choose a different one.
                  </p>
                )}
                {state.error === "invalid_slug" && (
                  <p role="alert" className="text-sm text-destructive">
                    {state.slugError ??
                      "Slug must contain only lowercase letters, numbers, and hyphens."}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Used in your reporter config as{" "}
                  <code className="font-mono">projectSlug</code>.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="project-description">Description</Label>
                <Input
                  id="project-description"
                  name="description"
                  placeholder="Optional description"
                  value={descValue}
                  onChange={(e) => setDescValue(e.target.value)}
                />
              </div>

              {state.error === "project_limit_reached" && (
                <Alert
                  variant="destructive"
                  data-testid="create-project-error"
                >
                  <AlertCircle className="size-4" />
                  <AlertTitle>Project limit reached</AlertTitle>
                  <AlertDescription>
                    You&apos;ve reached your plan&apos;s project limit.{" "}
                    <Link
                      href="/settings/billing"
                      className="underline font-medium"
                    >
                      Upgrade your plan
                    </Link>{" "}
                    to create more projects.
                  </AlertDescription>
                </Alert>
              )}

              {state.error === "unknown" && (
                <p role="alert" className="text-sm text-destructive">
                  Something went wrong. Please try again.
                </p>
              )}
            </div>

            <DialogFooter className="mt-6">
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="size-4 animate-spin" />}
                Create Project
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
