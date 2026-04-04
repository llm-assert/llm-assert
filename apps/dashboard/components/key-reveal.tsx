"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/copy-button";
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface KeyRevealProps {
  rawKey: string;
  projectSlug: string;
  onDone: () => void;
}

export function KeyReveal({ rawKey, projectSlug, onDone }: KeyRevealProps) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>API Key Created</DialogTitle>
        <DialogDescription>
          Your API key is shown below. Copy it now — you won't see it again.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label>API Key</Label>
          <div className="flex items-center gap-2">
            <Input readOnly value={rawKey} className="font-mono text-xs" />
            <CopyButton text={rawKey} label="API key" />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Project Slug</Label>
          <p className="font-mono text-sm text-muted-foreground">
            {projectSlug}
          </p>
        </div>

        <div className="space-y-2">
          <Label>Reporter Config</Label>
          <pre className="rounded-md border bg-muted p-3 text-xs overflow-x-auto">
            <code>{`// playwright.config.ts
reporter: [['@llmassert/playwright/reporter', {
  projectSlug: '${projectSlug}',
  apiKey: '${rawKey}',
}]]`}</code>
          </pre>
        </div>

        <p className="text-sm text-amber-500">
          Copy this key now. You won't see it again.
        </p>
      </div>

      <DialogFooter>
        <Button onClick={onDone}>Done</Button>
      </DialogFooter>
    </>
  );
}
