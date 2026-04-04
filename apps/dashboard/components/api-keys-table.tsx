"use client";

import { Key } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CopyButton } from "@/components/copy-button";
import { RevokeKeyDialog } from "@/components/revoke-key-dialog";
import { formatRelativeTime } from "@/lib/format";

interface ApiKey {
  id: string;
  key_prefix: string;
  label: string;
  last_used_at: string | null;
  created_at: string;
  revoked_at: string | null;
  project_id: string;
  projects:
    | { name: string; slug: string }[]
    | { name: string; slug: string }
    | null;
}

export function ApiKeysTable({ keys }: { keys: ApiKey[] }) {
  if (keys.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center gap-3">
        <div className="flex size-12 items-center justify-center rounded-lg bg-muted">
          <Key className="size-6 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <h3 className="font-medium">No API keys</h3>
          <p className="max-w-sm text-sm text-muted-foreground">
            Create an API key to start sending test results from the Playwright
            reporter.
          </p>
        </div>
      </div>
    );
  }

  return (
    <Table>
      <TableCaption className="sr-only">Your API keys</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Label</TableHead>
          <TableHead>Project</TableHead>
          <TableHead>Key Prefix</TableHead>
          <TableHead>Created</TableHead>
          <TableHead>Last Used</TableHead>
          <TableHead className="w-24">
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {keys.map((key) => {
          const isRevoked = key.revoked_at !== null;
          const project = Array.isArray(key.projects)
            ? key.projects[0]
            : key.projects;
          return (
            <TableRow
              key={key.id}
              className={isRevoked ? "opacity-50" : undefined}
            >
              <TableCell className="font-medium">{key.label}</TableCell>
              <TableCell className="text-muted-foreground">
                {project?.name ?? "Unknown project"}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <code className="font-mono text-xs">{key.key_prefix}...</code>
                  {!isRevoked && (
                    <CopyButton text={key.key_prefix} label="key prefix" />
                  )}
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground">
                <time dateTime={key.created_at}>
                  {formatRelativeTime(key.created_at)}
                </time>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {key.last_used_at ? (
                  <time dateTime={key.last_used_at}>
                    {formatRelativeTime(key.last_used_at)}
                  </time>
                ) : (
                  "Never"
                )}
              </TableCell>
              <TableCell>
                {isRevoked ? (
                  <Badge variant="destructive">Revoked</Badge>
                ) : (
                  <RevokeKeyDialog
                    keyId={key.id}
                    keyLabel={key.label}
                    keyPrefix={key.key_prefix}
                  />
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
