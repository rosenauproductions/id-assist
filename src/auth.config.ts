import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = Boolean(auth?.user);
      const { pathname } = request.nextUrl;

      // The marketing landing page — public to everyone. A signed-in
      // visitor is bounced to /app by the page itself (src/app/page.tsx),
      // not here, so this stays a plain allow.
      if (pathname === "/") {
        return true;
      }

      const isAuthPage =
        pathname.startsWith("/login") || pathname.startsWith("/signup");
      if (isAuthPage) {
        if (isLoggedIn) {
          return Response.redirect(new URL("/app", request.nextUrl));
        }
        return true;
      }
      return isLoggedIn;
    },
  },
  // The Credentials provider lives in auth.ts, not here — it touches the
  // database, and this config also has to be edge-safe for middleware.ts.
  providers: [],
} satisfies NextAuthConfig;
