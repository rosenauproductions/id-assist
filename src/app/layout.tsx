import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { auth, signOut } from "@/auth";
import { getAppearance } from "@/lib/settings/store";
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

  return (
    <html
      lang="en"
      data-theme={appearance.themeMode}
      data-accent={appearance.accentTheme}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header className="border-b border-line bg-card/80 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
            <Link href="/" className="text-base font-semibold tracking-tight">
              ID Assist
            </Link>
            {session?.user ? (
              <div className="flex items-center gap-4">
                <Link href="/team" className="text-sm text-muted hover:text-foreground">
                  Team
                </Link>
                <Link
                  href="/settings"
                  className="text-sm text-muted hover:text-foreground"
                >
                  Settings
                </Link>
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
                    className="text-sm text-muted hover:text-foreground"
                  >
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
