import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

export default NextAuth(authConfig).auth;

export const config = {
  // Everything requires a session except: NextAuth's own routes; static
  // assets; the marketing root "/" (public — handled by the authorized()
  // callback so it can still special-case it, and by the page itself
  // redirecting a signed-in visitor to /app); the SME's own interview
  // share link (no ID Assist account, scoped by an unguessable token
  // instead of a session — same trust model as an invitations.token accept
  // link); and the Stripe webhook (called by Stripe itself, verified by
  // signature in the route handler, never by a session).
  //
  // "/" itself still passes through this matcher (it isn't excluded here)
  // so that authorized() in auth.config.ts gets a chance to run and allow
  // it — the actual "public" behavior for "/" lives in that callback, not
  // in this regex.
  matcher: [
    "/((?!api/auth|api/stripe/webhook|_next/static|_next/image|favicon.ico|icon.svg|interview/link).*)",
  ],
};
