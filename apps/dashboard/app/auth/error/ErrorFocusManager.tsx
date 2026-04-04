"use client";

import { useEffect, useRef } from "react";

interface ErrorFocusManagerProps {
  children: React.ReactNode;
}

export function ErrorFocusManager({ children }: ErrorFocusManagerProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  return (
    <div ref={ref} tabIndex={-1} className="outline-none">
      {children}
    </div>
  );
}
