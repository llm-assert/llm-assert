"use client";

import { useCallback, useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopySlugButton({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(
    async (e: React.MouseEvent | React.KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      await navigator.clipboard.writeText(slug);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    },
    [slug],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        handleCopy(e);
      }
    },
    [handleCopy],
  );

  return (
    <>
      <button
        type="button"
        onClick={handleCopy}
        onKeyDown={handleKeyDown}
        className="inline-flex size-5 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground"
        aria-label={`Copy slug: ${slug}`}
      >
        {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
      </button>
      <span aria-live="polite" className="sr-only">
        {copied ? "Copied!" : ""}
      </span>
    </>
  );
}
