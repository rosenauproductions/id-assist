import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import {
  ChatBubbleLeftRightIcon,
  UsersIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  ShieldCheckIcon,
  QuestionMarkCircleIcon,
} from "@heroicons/react/20/solid";
import { auth, signOut } from "@/auth";
import { getAppearance } from "@/lib/settings/store";
import {
  getCurrentImpersonationBanner,
  isPlatformAdmin,
} from "@/lib/admin/store";
import { getCurrentBillingBanner } from "@/lib/billing/store";
import { stopImpersonationAction } from "@/app/admin/actions";
import { LogoMark } from "@/components/logo-mark";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ID Assist",
  description:
    "Instructional-design compiler: outline gate, filters, cost, artifacts, live tutor.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const appearance = await getAppearance();
  const [impersonation, showAdminNav, billingBanner] = await Promise.all([
    getCurrentImpersonationBanner(),
    session?.user?.id ? isPlatformAdmin(session.user.id) : Promise.resolve(false),
    session?.user?.id ? getCurrentBillingBanner() : Promise.resolve(null),
  ]);

  return (
    <html
      lang="en"
      data-theme={appearance.themeMode}
      data-accent={appearance.accentTheme}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {impersonation ? (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-warn/30 bg-warn/10 px-6 py-2 text-sm text-warn">
            <p>
              Viewing as <strong>{impersonation.targetEmail}</strong> —
              impersonated by {impersonation.adminEmail}, expires{" "}
              {new Date(impersonation.expiresAt).toLocaleTimeString()}
            </p>
            <form action={stopImpersonationAction}>
              <button
                type="submit"
                className="rounded-md border border-warn/40 px-3 py-1 text-xs font-medium hover:bg-warn/10"
              >
                Stop impersonating
              </button>
            </form>
          </div>
        ) : null}
        {billingBanner ? (
          <div
            className={`flex flex-wrap items-center justify-between gap-2 border-b px-6 py-2 text-sm ${
              billingBanner.status === "suspended" ||
              billingBanner.status === "canceled" ||
              billingBanner.isTrialExpired
                ? "border-danger/30 bg-danger/10 text-danger"
                : "border-warn/30 bg-warn/10 text-warn"
            }`}
          >
            <p>{billingBannerMessage(billingBanner)}</p>
            {billingBanner.isOwner ? (
              <Link
                href="/settings"
                className="rounded-md border border-current/40 px-3 py-1 text-xs font-medium hover:bg-current/10"
              >
                Manage billing
              </Link>
            ) : null}
          </div>
        ) : null}
        <header className="border-b border-line bg-card/80 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
            <Link
              href={session?.user ? "/app" : "/"}
              className="flex items-center gap-2 text-base font-semibold tracking-tight"
            >
              <LogoMark className="h-6 w-6" />
              ID Assist
            </Link>
            {session?.user ? (
              <div className="flex items-center gap-4">
                <Link
                  href="/interview"
                  className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground"
                >
                  <ChatBubbleLeftRightIcon className="h-4 w-4" />
                  Interview
                </Link>
                <Link
                  href="/team"
                  className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground"
                >
                  <UsersIcon className="h-4 w-4" />
                  Team
                </Link>
                <Link
                  href="/tickets"
                  className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground"
                >
                  <QuestionMarkCircleIcon className="h-4 w-4" />
                  Help
                </Link>
                <Link
                  href="/settings"
                  className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground"
                >
                  <Cog6ToothIcon className="h-4 w-4" />
                  Settings
                </Link>
                {showAdminNav ? (
                  <Link
                    href="/admin"
                    className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground"
                  >
                    <ShieldCheckIcon className="h-4 w-4" />
                    Admin
                  </Link>
                ) : null}
                <form
                  action={async () => {
                    "use server";
                    await signOut({ redirectTo: "/login" });
                  }}
                  className="flex items-center gap-3"
                >
                  <span className="text-sm text-muted">{session.user.email}</span>
                  <button
                    type="submit"
                    className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground"
                  >
                    <ArrowRightOnRectangleIcon className="h-4 w-4" />
                    Sign out
                  </button>
                </form>
              </div>
            ) : (
              <p className="text-sm text-muted">Human in the loop</p>
            )}
          </div>
        </header>
        <div className="flex-1">{children}</div>
      </body>
    </html>
  );
}

function billingBannerMessage(banner: {
  status: "trialing" | "active" | "past_due" | "suspended" | "canceled";
  trialDaysLeft: number | null;
  isTrialExpired: boolean;
}): string {
  if (banner.status === "suspended") {
    return "This account has been suspended. Contact support to reactivate it.";
  }
  if (banner.status === "canceled") {
    return "This account's subscription was canceled — upgrade to keep creating and editing courses.";
  }
  if (banner.status === "past_due") {
    return "There's a problem with this account's card — update payment to avoid interruption.";
  }
  if (banner.isTrialExpired) {
    return "Your free trial has ended — upgrade to keep creating and editing courses.";
  }
  if (banner.trialDaysLeft !== null) {
    return `${banner.trialDaysLeft} day${banner.trialDaysLeft === 1 ? "" : "s"} left in your free trial.`;
  }
  return "Your free trial is ending soon.";
}
