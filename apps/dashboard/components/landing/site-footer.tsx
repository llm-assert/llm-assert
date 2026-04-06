import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t py-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 sm:flex-row">
        <p className="text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} LLMAssert. All rights reserved.
        </p>
        <nav className="flex gap-6">
          <a
            href="https://docs.llmassert.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Docs
          </a>
          <a
            href="https://github.com/llm-assert/llm-assert"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            GitHub
          </a>
          <Link
            href="/sign-up"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Sign Up
          </Link>
        </nav>
      </div>
    </footer>
  );
}
