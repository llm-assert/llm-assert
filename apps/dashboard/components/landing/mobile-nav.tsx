"use client";

import { memo, useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export const MobileNav = memo(function MobileNav({
  links,
}: {
  links: { label: string; href: string }[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-72">
        <SheetTitle className="text-lg font-semibold">LLMAssert</SheetTitle>
        <nav className="mt-6 flex flex-col gap-4">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
          <Button variant="ghost" asChild className="justify-start">
            <Link href="/sign-in" onClick={() => setOpen(false)}>
              Sign In
            </Link>
          </Button>
          <Button asChild>
            <Link href="/sign-up" onClick={() => setOpen(false)}>
              Get Started
            </Link>
          </Button>
        </nav>
      </SheetContent>
    </Sheet>
  );
});
