import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

export default NextAuth(authConfig).auth;

export const config = {
  // Everything requires a session except NextAuth's own routes, static
  // assets, and the SME's own interview share link — that includes /login,
  // /signup (handled by the authorized() callback in auth.config.ts) and
  // the /api/tutor, /api/brief-coach, and artifact-download routes, which
  // all need a logged-in user too. /interview/link/[token] is deliberately
  // public: an SME filling out their own interview has no ID Assist
  // account, and the unguessable token is what scopes their access, not a
  // session (same trust model as an invitations.token accept link).
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|interview/link).*)",
  ],
};
