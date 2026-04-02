"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import { Check, Copy } from "lucide-react";

export function CopyButton({
  text,
  label,
  className,
}: {
  text: string;
  label: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable (e.g., unfocused tab, non-HTTPS)
    }
  }, [text]);

  return (
    <>
      <button
        type="button"
        onClick={handleCopy}
        className={
          className ??
          "inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        }
        aria-label={`Copy ${label} to clipboard`}
      >
        {copied ? (
          <Check className="size-3.5" />
        ) : (
          <Copy className="size-3.5" />
        )}
      </button>
      <span aria-live="polite" aria-atomic="true" className="sr-only">
        {copied ? `${label} copied to clipboard` : ""}
      </span>
    </>
  );
}
