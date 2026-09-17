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
  renameAccount,
  requirePlatformAdmin,
  setAccountManagerLabel,
  setAccountStatus,
  startImpersonation,
} from "@/lib/admin/store";
import type { MemberRole } from "@/lib/team/store";
import {
  isFontFamilyId,
  updatePlatformDefaults,
  updateSiteSettings,
  type FeatureCardCopy,
} from "@/lib/platform/settings";
import {
  addTicketMessage,
  setTicketStatus,
  type TicketStatus,
} from "@/lib/tickets/store";

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

export async function renameAccountAction(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const name = String(formData.get("name") ?? "");

  await renameAccount({ workspaceId, actorUserId: admin.userId, name });
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

function trimmedOrNull(value: FormDataEntryValue | null): string | null {
  const str = String(value ?? "").trim();
  return str || null;
}

export async function updateSiteSettingsAction(formData: FormData) {
  await requirePlatformAdmin();

  const featureCards: FeatureCardCopy[] = [0, 1, 2, 3].map((index) => ({
    title: String(formData.get(`cardTitle${index}`) ?? "").trim(),
    description: String(formData.get(`cardDescription${index}`) ?? "").trim(),
  }));
  const hasAnyCardCopy = featureCards.some(
    (card) => card.title || card.description,
  );

  const fontFamilyRaw = formData.get("fontFamily");
  await updateSiteSettings({
    heroEyebrow: trimmedOrNull(formData.get("heroEyebrow")),
    heroHeadline: trimmedOrNull(formData.get("heroHeadline")),
    heroSubhead: trimmedOrNull(formData.get("heroSubhead")),
    heroCtaLabel: trimmedOrNull(formData.get("heroCtaLabel")),
    accentColor: trimmedOrNull(formData.get("accentColor")),
    backgroundColor: trimmedOrNull(formData.get("backgroundColor")),
    fontFamily: isFontFamilyId(fontFamilyRaw) ? fontFamilyRaw : null,
    featureCards: hasAnyCardCopy ? featureCards : null,
  });
  revalidatePath("/admin/settings");
  revalidatePath("/");
}

export async function updatePlatformDefaultsAction(formData: FormData) {
  await requirePlatformAdmin();

  const trialDays = Number(formData.get("trialDays"));
  const monthlyGenerationLimit = Number(formData.get("monthlyGenerationLimit"));
  if (!Number.isFinite(trialDays) || trialDays <= 0) {
    throw new Error("Trial length must be a positive number of days.");
  }
  if (!Number.isFinite(monthlyGenerationLimit) || monthlyGenerationLimit <= 0) {
    throw new Error("Monthly generation cap must be a positive number.");
  }

  await updatePlatformDefaults({
    trialDays: Math.round(trialDays),
    monthlyGenerationLimit: Math.round(monthlyGenerationLimit),
  });
  revalidatePath("/admin/settings");
}

export async function addAdminTicketMessageAction(
  ticketId: string,
  body: string,
): Promise<void> {
  const admin = await requirePlatformAdmin();
  await addTicketMessage({ ticketId, authorUserId: admin.userId, body });
  revalidatePath(`/admin/tickets/${ticketId}`);
}

export async function setTicketStatusAction(
  ticketId: string,
  status: TicketStatus,
): Promise<void> {
  await requirePlatformAdmin();
  await setTicketStatus(ticketId, status);
  revalidatePath(`/admin/tickets/${ticketId}`);
  revalidatePath("/admin/tickets");
}
