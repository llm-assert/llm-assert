import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { getAuthErrorConfig } from "@/lib/auth/error-messages";
import { ErrorFocusManager } from "./ErrorFocusManager";
import { HashErrorDisplay } from "./HashErrorDisplay";

export const metadata: Metadata = {
  title: "Auth Error - LLMAssert",
  robots: { index: false },
};

export default async function AuthErrorPage(props: {
  searchParams: Promise<{ code?: string }>;
}) {
  const searchParams = await props.searchParams;
  const code = searchParams.code;
  const config = getAuthErrorConfig(code);

  return (
    <HashErrorDisplay hasSearchParamCode={!!code}>
      <Card>
        <CardHeader className="items-center gap-4 text-center">
          <div className="flex size-12 items-center justify-center rounded-lg bg-destructive/10">
            <AlertTriangle
              className="size-6 text-destructive"
              aria-hidden="true"
            />
          </div>
          <ErrorFocusManager>
            <div role="alert" aria-live="assertive" aria-atomic="true">
              <h1 className="text-xl font-semibold">{config.title}</h1>
            </div>
          </ErrorFocusManager>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-sm text-muted-foreground">{config.message}</p>
        </CardContent>
        <CardFooter className="flex flex-col gap-2">
          <Button asChild className="w-full">
            <Link href={config.cta.href}>{config.cta.label}</Link>
          </Button>
          {config.secondaryCta && (
            <Button asChild variant="outline" className="w-full">
              <Link href={config.secondaryCta.href}>
                {config.secondaryCta.label}
              </Link>
            </Button>
          )}
        </CardFooter>
      </Card>
    </HashErrorDisplay>
  );
}
