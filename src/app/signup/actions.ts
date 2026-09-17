"use server";

import { and, eq, isNull } from "drizzle-orm";
import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { db } from "@/lib/db/client";
import { invitations, users, workspaces } from "@/lib/db/schema";
import { hashPassword } from "@/lib/auth/password";
import { getPlatformDefaults } from "@/lib/platform/settings";

export async function signupAction(
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const inviteToken = String(formData.get("invite") ?? "").trim();

  if (!email || !password) return "Email and password are required.";
  if (password.length < 8) return "Password must be at least 8 characters.";

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existing) return "An account with that email already exists.";

  let workspaceId: string;
  let role: "owner" | "member" = "owner";
  let acceptedInvitationId: string | null = null;

  if (inviteToken) {
    const [invitation] = await db
      .select()
      .from(invitations)
      .where(
        and(eq(invitations.token, inviteToken), isNull(invitations.acceptedAt)),
      )
      .limit(1);
    if (!invitation) {
      return "This invite link is no longer valid. Ask for a fresh one, or sign up without it.";
    }
    if (invitation.email !== email) {
      return "This invite was sent to a different email address.";
    }
    workspaceId = invitation.workspaceId;
    role = invitation.role as "owner" | "member";
    acceptedInvitationId = invitation.id;
  } else {
    const { trialDays } = await getPlatformDefaults();
    const trialEndsAt = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000);
    const [workspace] = await db
      .insert(workspaces)
      .values({ name: `${email}'s workspace`, status: "trialing", trialEndsAt })
      .returning({ id: workspaces.id });
    workspaceId = workspace.id;
  }

  await db.insert(users).values({
    email,
    passwordHash: hashPassword(password),
    workspaceId,
    role,
  });

  if (acceptedInvitationId) {
    await db
      .update(invitations)
      .set({ acceptedAt: new Date() })
      .where(eq(invitations.id, acceptedInvitationId));
  }

  try {
    await signIn("credentials", { email, password, redirectTo: "/app" });
  } catch (error) {
    if (error instanceof AuthError) {
      return "Account created — sign in below.";
    }
    throw error;
  }
}
