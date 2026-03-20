"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useOrg } from "@/components/org-provider";

type NavItem = {
  value: string;
  label: string;
  href: string;
};

export function OrgNav() {
  const pathname = usePathname();
  const { orgId, role } = useOrg();
  const basePath = `/orgs/${orgId}`;

  const items: NavItem[] = [
    { value: "suites", label: "Suites", href: `${basePath}/suites` },
    { value: "members", label: "Members", href: `${basePath}/members` },
  ];

  if (role === "admin") {
    items.push(
      { value: "invites", label: "Invites", href: `${basePath}/invites` },
      { value: "settings", label: "Settings", href: `${basePath}/settings` }
    );
  }

  const active =
    items.find((item) => pathname?.startsWith(item.href))?.value ?? "suites";

  return (
    <Tabs value={active}>
      <TabsList variant="line">
        {items.map((item) => (
          <TabsTrigger key={item.value} value={item.value} asChild>
            <Link href={item.href}>{item.label}</Link>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
