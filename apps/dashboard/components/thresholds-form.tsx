"use client";

import { useState, useActionState, useRef } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  saveThresholdsAction,
  type SaveThresholdsState,
} from "@/app/(dashboard)/settings/thresholds/actions";

const DEFAULT_THRESHOLD = "0.7";

const ASSERTION_DESCRIPTIONS: Record<string, string> = {
  groundedness:
    "Is the response grounded in the source context? 1.0 = fully grounded, 0.0 = hallucinated.",
  pii: "Does the text contain PII? 1.0 = no PII detected, 0.0 = PII present. Higher threshold = stricter detection.",
  sentiment:
    "Does the text match the described tone? 1.0 = perfect match, 0.0 = opposite tone.",
  schema:
    "Does the text conform to the expected structure? 1.0 = fully conformant, 0.0 = no conformance.",
  fuzzy:
    "Semantic similarity to the reference text. 1.0 = identical meaning, 0.0 = completely unrelated.",
};

const ASSERTION_LABELS: Record<string, string> = {
  groundedness: "Groundedness",
  pii: "PII Detection",
  sentiment: "Sentiment",
  schema: "Schema",
  fuzzy: "Fuzzy Match",
};

interface ThresholdEntry {
  assertionType: string;
  value: number;
}

export function ThresholdsForm({
  projectId,
  thresholds,
}: {
  projectId: string;
  thresholds: ThresholdEntry[];
}) {
  const [state, formAction, isPending] = useActionState<
    SaveThresholdsState,
    FormData
  >(saveThresholdsAction, {});

  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      thresholds.map((t) => [t.assertionType, String(t.value)]),
    ),
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  function updateValue(assertionType: string, value: string) {
    setValues((prev) => ({ ...prev, [assertionType]: value }));
  }

  function handleSubmitClick(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    setConfirmOpen(true);
  }

  function handleConfirm() {
    setConfirmOpen(false);
    formRef.current?.requestSubmit();
  }

  return (
    <form ref={formRef} action={formAction} className="space-y-6">
      <input type="hidden" name="projectId" value={projectId} />

      <div className="space-y-4">
        {thresholds.map((t) => {
          const id = `threshold-${t.assertionType}`;
          const currentValue = values[t.assertionType] ?? DEFAULT_THRESHOLD;
          const isDefault = parseFloat(currentValue) === 0.7;

          return (
            <div key={t.assertionType} className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Label htmlFor={id}>{ASSERTION_LABELS[t.assertionType]}</Label>
                {!isDefault && (
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground"
                    title="Reset to default (0.70)"
                    aria-label={`Reset ${ASSERTION_LABELS[t.assertionType]} to default`}
                    onClick={() =>
                      updateValue(t.assertionType, DEFAULT_THRESHOLD)
                    }
                  >
                    <RotateCcw className="size-3.5" />
                  </button>
                )}
              </div>
              <Input
                id={id}
                name={t.assertionType}
                type="number"
                min={0}
                max={1}
                step={0.01}
                inputMode="decimal"
                value={currentValue}
                onChange={(e) => updateValue(t.assertionType, e.target.value)}
                required
                aria-describedby={`${id}-desc`}
              />
              <p id={`${id}-desc`} className="text-xs text-muted-foreground">
                {ASSERTION_DESCRIPTIONS[t.assertionType]}
              </p>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <Button type="button" disabled={isPending} onClick={handleSubmitClick}>
          {isPending ? "Saving…" : "Save Changes"}
        </Button>

        {state.success && (
          <p role="status" className="text-sm text-emerald-600">
            Thresholds updated. Changes will apply to future CI runs using
            dashboard thresholds.
          </p>
        )}
        {state.error && (
          <p role="alert" className="text-sm text-destructive">
            {state.error === "validation_failed"
              ? "Invalid threshold values. Each must be between 0 and 1."
              : state.error === "project_not_found"
                ? "Project not found."
                : state.error === "rate_limited"
                  ? "Too many requests. Please wait a moment and try again."
                  : "Failed to save thresholds. Please try again."}
          </p>
        )}
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update thresholds?</DialogTitle>
            <DialogDescription>
              Changing thresholds may affect your CI pipeline results. Tests
              using dashboard thresholds will use these new values on their next
              run.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirm}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  );
}
