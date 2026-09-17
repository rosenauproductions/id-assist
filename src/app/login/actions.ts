"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { isPlatformAdminByEmail } from "@/lib/admin/store";

export async function loginAction(
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const email = String(formData.get("email") ?? "");
  try {
    // Platform admins (Chris) land straight on the client-manager area
    // instead of the course-building dashboard, since that's what they
    // actually come here to do. Looked up by email before signIn runs —
    // this only picks where a *successful* login redirects to; a wrong
    // password still fails the same way regardless of what's found here.
    const isAdmin = email ? await isPlatformAdminByEmail(email) : false;
    await signIn("credentials", {
      email,
      password: formData.get("password"),
      redirectTo: isAdmin ? "/admin" : "/app",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return "Invalid email or password.";
    }
    throw error;
  }
}
