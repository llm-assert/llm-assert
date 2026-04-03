"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Key, SlidersHorizontal, CreditCard } from "lucide-react";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const items = [
  { title: "API Keys", href: "/settings/keys", icon: Key },
  {
    title: "Thresholds",
    href: "/settings/thresholds",
    icon: SlidersHorizontal,
  },
  { title: "Billing", href: "/settings/billing", icon: CreditCard },
];

export function NavSettings() {
  const pathname = usePathname();

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Settings</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                asChild
                isActive={pathname.startsWith(item.href)}
              >
                <Link href={item.href}>
                  <item.icon />
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
