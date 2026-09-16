"use server";

import { revalidatePath } from "next/cache";
import {
  createInvitation,
  removeMember,
  requireOwner,
  requireWorkspaceContext,
  revokeInvitation,
  setMemberRole,
  type MemberRole,
} from "@/lib/team/store";

function parseRole(value: FormDataEntryValue | null): MemberRole {
  return value === "owner" ? "owner" : "member";
}

export async function inviteMemberAction(formData: FormData) {
  const context = await requireWorkspaceContext();
  requireOwner(context);

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    throw new Error("Enter a valid email address.");
  }
  const role = parseRole(formData.get("role"));

  await createInvitation({
    workspaceId: context.workspaceId,
    invitedByUserId: context.userId,
    email,
    role,
  });
  revalidatePath("/team");
  revalidatePath("/");
}

export async function revokeInvitationAction(invitationId: string) {
  const context = await requireWorkspaceContext();
  requireOwner(context);
  await revokeInvitation(invitationId, context.workspaceId);
  revalidatePath("/team");
}

export async function removeMemberAction(memberUserId: string) {
  const context = await requireWorkspaceContext();
  requireOwner(context);
  await removeMember(memberUserId, context.workspaceId);
  revalidatePath("/team");
  revalidatePath("/");
}

export async function setMemberRoleAction(formData: FormData) {
  const context = await requireWorkspaceContext();
  requireOwner(context);
  const memberUserId = String(formData.get("memberUserId") ?? "");
  const role = parseRole(formData.get("role"));
  await setMemberRole(memberUserId, context.workspaceId, role);
  revalidatePath("/team");
}
