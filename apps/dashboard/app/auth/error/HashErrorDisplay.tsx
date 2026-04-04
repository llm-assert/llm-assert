"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import {
  getAuthErrorConfig,
  type AuthErrorConfig,
} from "@/lib/auth/error-messages";

interface HashErrorDisplayProps {
  hasSearchParamCode: boolean;
  children: React.ReactNode;
}

/**
 * Wraps the server-rendered error Card. If a hash fragment error is detected
 * and no searchParam code was provided, replaces the server content entirely.
 */
export function HashErrorDisplay({
  hasSearchParamCode,
  children,
}: HashErrorDisplayProps) {
  const [hashError, setHashError] = useState<AuthErrorConfig | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (hasSearchParamCode) return;

    const hash = window.location.hash.slice(1);
    if (!hash) return;

    const params = new URLSearchParams(hash);
    const errorCode = params.get("error_code");
    if (errorCode) {
      setHashError(getAuthErrorConfig(errorCode));
    }
  }, [hasSearchParamCode]);

  useEffect(() => {
    if (hashError && containerRef.current) {
      containerRef.current.focus();
    }
  }, [hashError]);

  if (!hashError) return <>{children}</>;

  return (
    <div ref={containerRef} tabIndex={-1} className="outline-none">
      <Card>
        <CardHeader className="items-center gap-4 text-center">
          <div className="flex size-12 items-center justify-center rounded-lg bg-destructive/10">
            <AlertTriangle
              className="size-6 text-destructive"
              aria-hidden="true"
            />
          </div>
          <div role="alert" aria-live="assertive" aria-atomic="true">
            <h1 className="text-xl font-semibold">{hashError.title}</h1>
          </div>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-sm text-muted-foreground">{hashError.message}</p>
        </CardContent>
        <CardFooter className="flex flex-col gap-2">
          <Button asChild className="w-full">
            <Link href={hashError.cta.href}>{hashError.cta.label}</Link>
          </Button>
          {hashError.secondaryCta && (
            <Button asChild variant="outline" className="w-full">
              <Link href={hashError.secondaryCta.href}>
                {hashError.secondaryCta.label}
              </Link>
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
