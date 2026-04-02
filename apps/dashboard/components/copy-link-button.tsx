"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import { Check, Link as LinkIcon } from "lucide-react";

export function CopyLinkButton({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleCopy = useCallback(async () => {
    try {
      const fullUrl = `${window.location.origin}${path}`;
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable
    }
  }, [path]);

  return (
    <>
      <button
        type="button"
        onClick={handleCopy}
        className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        aria-label="Copy evaluation link to clipboard"
      >
        {copied ? (
          <Check className="size-3.5" />
        ) : (
          <LinkIcon className="size-3.5" />
        )}
      </button>
      <span aria-live="polite" aria-atomic="true" className="sr-only">
        {copied ? "Evaluation link copied to clipboard" : ""}
      </span>
    </>
  );
}
