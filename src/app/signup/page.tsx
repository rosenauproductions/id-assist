import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { invitations, workspaces } from "@/lib/db/schema";
import { SignupForm } from "./signup-form";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  const { invite } = await searchParams;
  let invitePreview:
    | { token: string; email: string; workspaceName: string }
    | null = null;
  let inviteInvalid = false;

  if (invite) {
    const [row] = await db
      .select({ email: invitations.email, workspaceName: workspaces.name })
      .from(invitations)
      .innerJoin(workspaces, eq(workspaces.id, invitations.workspaceId))
      .where(and(eq(invitations.token, invite), isNull(invitations.acceptedAt)))
      .limit(1);
    if (row) {
      invitePreview = { token: invite, email: row.email, workspaceName: row.workspaceName };
    } else {
      inviteInvalid = true;
    }
  }

  return (
    <main className="mx-auto max-w-sm px-6 py-16">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-accent">
        ID Assist
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">
        {invitePreview ? `Join ${invitePreview.workspaceName}` : "Create an account"}
      </h1>
      {invitePreview ? (
        <p className="mt-2 text-sm text-muted">
          You&apos;ve been invited to collaborate on courses in this workspace.
        </p>
      ) : inviteInvalid ? (
        <p className="mt-2 text-sm text-warn">
          That invite link is no longer valid — you can still create your own
          account below.
        </p>
      ) : null}
      <SignupForm invitePreview={invitePreview} />
    </main>
  );
}
