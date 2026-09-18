"use server";

import { redirect } from "next/navigation";
import { consumePasswordResetToken } from "@/lib/auth/password-reset";

export async function resetPasswordAction(
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const token = String(formData.get("token") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!token) return "This link is invalid.";
  if (newPassword !== confirmPassword) return "Passwords don't match.";

  try {
    await consumePasswordResetToken(token, newPassword);
  } catch (error) {
    return error instanceof Error ? error.message : "Could not reset password.";
  }

  redirect("/login");
}
