import Link from "next/link";
import { auth } from "@/auth";
import { AcceptInviteForm } from "@/app/(auth)/invite/[token]/accept-form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { prisma } from "@/lib/prisma";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    throw new Error("Expected authenticated session");
  }

  const invite = await prisma.invite.findUnique({
    where: { token },
    include: { org: true },
  });

  const isExpired = invite ? invite.expiresAt < new Date() : false;
  const existingMembership = invite
    ? await prisma.orgMembership.findUnique({
        where: {
          orgId_userId: {
            orgId: invite.orgId,
            userId,
          },
        },
      })
    : null;

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-6">
      <Card className="w-full max-w-lg">
        {!invite ? (
          <>
            <CardHeader>
              <CardTitle>Invite not found</CardTitle>
              <CardDescription>
                This invite link is invalid or has been revoked.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/dashboard">Go to Dashboard</Link>
              </Button>
            </CardContent>
          </>
        ) : isExpired ? (
          <>
            <CardHeader>
              <CardTitle>Invite expired</CardTitle>
              <CardDescription>
                This invite link has expired. Ask an admin to send a new one.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/dashboard">Go to Dashboard</Link>
              </Button>
            </CardContent>
          </>
        ) : existingMembership ? (
          <>
            <CardHeader>
              <CardTitle>You are already a member</CardTitle>
              <CardDescription>
                You already belong to {invite.org.name}.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href={`/orgs/${invite.orgId}/suites`}>
                  Go to Organization
                </Link>
              </Button>
            </CardContent>
          </>
        ) : (
          <>
            <CardHeader>
              <CardTitle>Join {invite.org.name}</CardTitle>
              <CardDescription>
                Accept the invite to become a member of this organization.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AcceptInviteForm token={token} />
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}
