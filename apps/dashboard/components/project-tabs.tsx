"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { label: "Overview", segment: "" },
  { label: "Runs", segment: "/runs" },
  { label: "Trends", segment: "/trends" },
] as const;

export function ProjectTabs({ slug }: { slug: string }) {
  const pathname = usePathname();
  const base = `/projects/${slug}`;

  return (
    <nav className="flex gap-4 border-b" aria-label="Project navigation">
      {TABS.map((tab) => {
        const href = `${base}${tab.segment}`;
        const isActive =
          tab.segment === ""
            ? pathname === base
            : pathname.startsWith(href);

        return (
          <Link
            key={tab.label}
            href={href}
            className={cn(
              "-mb-px border-b-2 px-1 pb-3 text-sm font-medium transition-colors",
              isActive
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
