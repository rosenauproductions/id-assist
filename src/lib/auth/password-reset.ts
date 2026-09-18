import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { passwordResetTokens, users } from "@/lib/db/schema";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { generateInviteToken } from "@/lib/auth/invite-token";

const RESET_LINK_HOURS = 24;
const MIN_PASSWORD_LENGTH = 8;

export type PendingPasswordReset = {
  id: string;
  userId: string;
  email: string;
  token: string;
  createdAt: string;
  expiresAt: string;
};

/**
 * Platform-admin-generated "set a new password" link for someone who's
 * locked out. Same opaque-token/resend-replaces-prior pattern as
 * lib/team/store.ts's createInvitation — the admin copies the link
 * (/reset-password?token=<token>) and sends it however they reach that
 * person (text, email client, whatever — this app sends no mail itself).
 */
export async function createPasswordResetLink(input: {
  targetUserId: string;
  actorUserId: string;
}): Promise<string> {
  await db
    .delete(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.userId, input.targetUserId),
        isNull(passwordResetTokens.usedAt),
      ),
    );

  const token = generateInviteToken();
  const expiresAt = new Date(Date.now() + RESET_LINK_HOURS * 60 * 60 * 1000);

  await db.insert(passwordResetTokens).values({
    userId: input.targetUserId,
    createdByUserId: input.actorUserId,
    token,
    expiresAt,
  });

  return token;
}

/** Unused, unexpired reset links for members of one workspace — rendered
 * next to pending invitations on the admin account page. */
export async function listPendingPasswordResets(
  workspaceId: string,
): Promise<PendingPasswordReset[]> {
  const rows = await db
    .select({
      id: passwordResetTokens.id,
      userId: passwordResetTokens.userId,
      email: users.email,
      token: passwordResetTokens.token,
      createdAt: passwordResetTokens.createdAt,
      expiresAt: passwordResetTokens.expiresAt,
    })
    .from(passwordResetTokens)
    .innerJoin(users, eq(users.id, passwordResetTokens.userId))
    .where(
      and(
        eq(users.workspaceId, workspaceId),
        isNull(passwordResetTokens.usedAt),
        gt(passwordResetTokens.expiresAt, new Date()),
      ),
    );

  return rows.map((row) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
  }));
}

/** Spends a reset link — checked for existence, expiry, and single-use
 * before the password is actually changed. No signed-in session required,
 * the token itself is the credential. Throws with a user-facing message
 * on any failure, same convention as the rest of lib/*\/store.ts. */
export async function consumePasswordResetToken(
  token: string,
  newPassword: string,
): Promise<void> {
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }

  const [row] = await db
    .select()
    .from(passwordResetTokens)
    .where(eq(passwordResetTokens.token, token))
    .limit(1);

  if (!row) throw new Error("This link is invalid.");
  if (row.usedAt) throw new Error("This link has already been used.");
  if (row.expiresAt.getTime() < Date.now()) {
    throw new Error("This link has expired — ask for a new one.");
  }

  await db
    .update(users)
    .set({ passwordHash: hashPassword(newPassword) })
    .where(eq(users.id, row.userId));

  await db
    .update(passwordResetTokens)
    .set({ usedAt: new Date() })
    .where(eq(passwordResetTokens.id, row.id));
}

/** Self-service change from /settings — requires the current password,
 * unlike the admin-issued link above. */
export async function changeOwnPassword(input: {
  userId: string;
  currentPassword: string;
  newPassword: string;
}): Promise<void> {
  if (input.newPassword.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`New password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }

  const [user] = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, input.userId))
    .limit(1);
  if (!user) throw new Error("Account not found.");

  if (!verifyPassword(input.currentPassword, user.passwordHash)) {
    throw new Error("Current password is incorrect.");
  }

  await db
    .update(users)
    .set({ passwordHash: hashPassword(input.newPassword) })
    .where(eq(users.id, input.userId));
}
