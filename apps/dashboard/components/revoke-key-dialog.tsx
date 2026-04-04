"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { revokeApiKeyAction } from "@/app/(dashboard)/settings/keys/actions";

interface RevokeKeyDialogProps {
  keyId: string;
  keyLabel: string;
  keyPrefix: string;
}

export function RevokeKeyDialog({
  keyId,
  keyLabel,
  keyPrefix,
}: RevokeKeyDialogProps) {
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const handleRevoke = async () => {
    setLoading(true);
    try {
      await revokeApiKeyAction(keyId);
      setOpen(false);
    } catch {
      // Error handled by server action; revalidation will update the UI
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label={`Revoke API key ${keyLabel}`}
        >
          Revoke
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Revoke API key?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently revoke the key <strong>{keyLabel}</strong> (
            <code className="font-mono text-xs">{keyPrefix}...</code>
            ). Any Playwright reporter using this key will receive 401 errors.
            In-flight test runs may lose partial data.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={(e) => {
              e.preventDefault();
              handleRevoke();
            }}
            disabled={loading}
          >
            {loading && <Loader2 className="size-4 animate-spin" />}
            Revoke Key
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
