import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { after } from "next/server";
import { authConfig } from "./auth.config";
import { db } from "./lib/db/client";
import { users } from "./lib/db/schema";
import { verifyPassword } from "./lib/auth/password";
import { recordLoginEvent } from "./lib/admin/login-events";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const email = String(credentials?.email ?? "").trim().toLowerCase();
        const password = String(credentials?.password ?? "");
        if (!email || !password) return null;

        // Logged distinctly from a bad password/unknown email (both of
        // which return null and produce the same generic "Invalid email
        // or password" message on the login form) so a real backend
        // failure here is visible in Vercel's Runtime Logs instead of
        // being indistinguishable from a typo'd password.
        try {
          const [user] = await db
            .select()
            .from(users)
            .where(eq(users.email, email))
            .limit(1);
          if (!user) {
            console.warn(`[auth] no user found for ${email}`);
            return null;
          }
          if (!verifyPassword(password, user.passwordHash)) {
            console.warn(`[auth] password mismatch for ${email}`);
            return null;
          }

          // Best-effort login-event capture for the /admin login map — see
          // login-events.ts. after() defers this until the response is on
          // its way out, so the geolocation lookup it kicks off never adds
          // latency to the actual sign-in.
          const forwardedFor = (await headers()).get("x-forwarded-for");
          const ip = forwardedFor?.split(",")[0]?.trim() || null;
          after(() =>
            recordLoginEvent({ userId: user.id, workspaceId: user.workspaceId, ip }),
          );

          return { id: user.id, email: user.email };
        } catch (err) {
          console.error(`[auth] authorize() threw for ${email}:`, err);
          throw err;
        }
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    session({ session, token }) {
      if (session.user) session.user.id = token.id as string;
      return session;
    },
  },
});
