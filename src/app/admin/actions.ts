"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  addAccountNote,
  addUserToAccount,
  createAccount,
  endImpersonation,
  impersonationCookieName,
  isAccountStatus,
  requirePlatformAdmin,
  setAccountManagerLabel,
  setAccountStatus,
  startImpersonation,
} from "@/lib/admin/store";
import type { MemberRole } from "@/lib/team/store";

function parseRole(value: FormDataEntryValue | null): MemberRole {
  return value === "owner" ? "owner" : "member";
}

export async function createAccountAction(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const name = String(formData.get("name") ?? "");
  const ownerEmail = String(formData.get("ownerEmail") ?? "");

  const { workspaceId } = await createAccount({
    actorUserId: admin.userId,
    name,
    ownerEmail,
  });
  revalidatePath("/admin");
  redirect(`/admin/accounts/${workspaceId}`);
}

export async function setAccountStatusAction(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const statusValue = formData.get("status");
  if (!isAccountStatus(statusValue)) {
    throw new Error("Unknown account status.");
  }

  await setAccountStatus({
    workspaceId,
    actorUserId: admin.userId,
    status: statusValue,
  });
  revalidatePath(`/admin/accounts/${workspaceId}`);
  revalidatePath("/admin");
}

export async function setAccountManagerAction(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const label = String(formData.get("label") ?? "");

  await setAccountManagerLabel({ workspaceId, actorUserId: admin.userId, label });
  revalidatePath(`/admin/accounts/${workspaceId}`);
  revalidatePath("/admin");
}

export async function addUserToAccountAction(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = parseRole(formData.get("role"));
  if (!email || !email.includes("@")) {
    throw new Error("Enter a valid email address.");
  }

  await addUserToAccount({ workspaceId, actorUserId: admin.userId, email, role });
  revalidatePath(`/admin/accounts/${workspaceId}`);
}

export async function addAccountNoteAction(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const body = String(formData.get("body") ?? "");

  await addAccountNote({ workspaceId, actorUserId: admin.userId, body });
  revalidatePath(`/admin/accounts/${workspaceId}`);
}

export async function startImpersonationAction(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const targetUserId = String(formData.get("targetUserId") ?? "");
  const reason = String(formData.get("reason") ?? "");

  const { token, expiresAt } = await startImpersonation({
    adminUserId: admin.userId,
    targetUserId,
    reason,
  });

  const cookieStore = await cookies();
  cookieStore.set(impersonationCookieName(), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
  redirect("/app");
}

export async function stopImpersonationAction() {
  // Deliberately checked before requirePlatformAdmin() throws on a bad
  // session, and reads the real (non-impersonated) identity — cookies()/
  // auth() both resolve to the actual logged-in admin regardless of the
  // impersonation cookie, which is what makes ending it always possible.
  const cookieStore = await cookies();
  const token = cookieStore.get(impersonationCookieName())?.value;
  const admin = await requirePlatformAdmin();

  if (token) {
    await endImpersonation(token, admin.userId);
    cookieStore.delete(impersonationCookieName());
  }
  redirect("/admin");
}
