import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import {
  ChatBubbleLeftRightIcon,
  UsersIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  ShieldCheckIcon,
} from "@heroicons/react/20/solid";
import { auth, signOut } from "@/auth";
import { getAppearance } from "@/lib/settings/store";
import {
  getCurrentImpersonationBanner,
  isPlatformAdmin,
} from "@/lib/admin/store";
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
  const [impersonation, showAdminNav] = await Promise.all([
    getCurrentImpersonationBanner(),
    session?.user?.id ? isPlatformAdmin(session.user.id) : Promise.resolve(false),
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
        <header className="border-b border-line bg-card/80 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
            <Link
              href="/"
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
