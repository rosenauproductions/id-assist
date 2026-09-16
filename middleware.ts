import NextAuth from "next-auth";
import { authConfig } from "./src/auth.config";

export default NextAuth(authConfig).auth;

export const config = {
  // Everything requires a session except NextAuth's own routes and static
  // assets — that includes /login, /signup (handled by the authorized()
  // callback in auth.config.ts) and the /api/tutor, /api/brief-coach, and
  // artifact-download routes, which all need a logged-in user too.
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
