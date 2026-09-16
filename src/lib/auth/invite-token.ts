import { randomBytes } from "node:crypto";

/** Opaque, unguessable token for an invite link — not a password, just a
 * shareable capability scoped to one workspace/email/role. */
export function generateInviteToken(): string {
  return randomBytes(24).toString("base64url");
}
