import Link from "next/link";
import { auth } from "@/auth";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { prisma } from "@/lib/prisma";

export default async function DashboardPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    throw new Error("Expected authenticated session");
  }

  const memberships = await prisma.orgMembership.findMany({
    where: { userId },
    include: { org: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Your Organizations"
        actions={
          <Button asChild>
            <Link href="/orgs/new">New Organization</Link>
          </Button>
        }
      />

      {memberships.length === 0 ? (
        <EmptyState
          title="No organizations yet"
          description="Create your first organization to get started."
          action={
            <Button asChild>
              <Link href="/orgs/new">Create Organization</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {memberships.map((membership) => (
            <Link
              key={membership.orgId}
              href={`/orgs/${membership.orgId}/suites`}
              className="block"
            >
              <Card className="transition hover:border-foreground/20 hover:shadow-sm">
                <CardHeader>
                  <CardTitle>{membership.org.name}</CardTitle>
                  <CardDescription className="font-mono">
                    {membership.org.slug}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Badge variant="secondary">{membership.role}</Badge>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
