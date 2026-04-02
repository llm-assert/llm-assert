"use client";

import {
  useActionState,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Check, Copy, Loader2, Plus } from "lucide-react";
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
  createProjectAction,
  type CreateProjectState,
} from "@/app/(dashboard)/actions";
import { nameToSlug } from "@/lib/slugify";

const initialState: CreateProjectState = {};

export function CreateProjectDialog() {
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
  const [copied, setCopied] = useState(false);
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
      setCopied(false);
    }
  }, []);

  // Focus name input when dialog opens in form mode
  useEffect(() => {
    if (open && !isKeyReveal) {
      setTimeout(() => nameRef.current?.focus(), 0);
    }
  }, [open, isKeyReveal]);

  const handleCopy = useCallback(async () => {
    if (state.rawKey) {
      await navigator.clipboard.writeText(state.rawKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [state.rawKey]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" />
          New Project
        </Button>
      </DialogTrigger>
      <DialogContent key={formKey} showCloseButton={!isKeyReveal}>
        {isKeyReveal ? (
          <>
            <DialogHeader>
              <DialogTitle>Project Created</DialogTitle>
              <DialogDescription>
                Your API key is shown below. Copy it now — you won't see it
                again.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>API Key</Label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={state.rawKey}
                    className="font-mono text-xs"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCopy}
                    aria-label="Copy API key"
                  >
                    {copied ? (
                      <Check className="size-4" />
                    ) : (
                      <Copy className="size-4" />
                    )}
                  </Button>
                </div>
                <div aria-live="polite" className="sr-only">
                  {copied ? "Copied to clipboard" : ""}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Project Slug</Label>
                <p className="font-mono text-sm text-muted-foreground">
                  {state.projectSlug}
                </p>
              </div>

              <div className="space-y-2">
                <Label>Reporter Config</Label>
                <pre className="rounded-md border bg-muted p-3 text-xs overflow-x-auto">
                  <code>{`// playwright.config.ts
reporter: [['@llmassert/playwright/reporter', {
  projectSlug: '${state.projectSlug}',
  apiKey: '${state.rawKey}',
}]]`}</code>
                </pre>
              </div>

              <p className="text-sm text-amber-500">
                Copy this key now. You won't see it again.
              </p>
            </div>

            <DialogFooter>
              <Button onClick={() => handleOpenChange(false)}>Done</Button>
            </DialogFooter>
          </>
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
