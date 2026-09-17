import Link from "next/link";

// One tab bar shared by every top-level page under /admin, so moving
// between Accounts/Tickets/Login map/Settings/Audit log reads as one
// section with sub-views rather than five loosely-linked pages. Each page
// passes its own id as `active`; the bar itself is a plain server
// component (just <Link>s), no client state needed.

const ADMIN_TABS = [
  { id: "accounts", href: "/admin", label: "Accounts" },
  { id: "tickets", href: "/admin/tickets", label: "Tickets" },
  { id: "logins", href: "/admin/logins", label: "Login map" },
  { id: "settings", href: "/admin/settings", label: "Settings" },
  { id: "audit", href: "/admin/audit", label: "Audit log" },
] as const;

export type AdminTabId = (typeof ADMIN_TABS)[number]["id"];

export function AdminTabs({ active }: { active: AdminTabId }) {
  return (
    <div className="mt-3 flex flex-wrap gap-1 border-b border-line">
      {ADMIN_TABS.map((tab) => (
        <Link
          key={tab.id}
          href={tab.href}
          className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
            active === tab.id
              ? "border-accent text-accent"
              : "border-transparent text-muted hover:border-line hover:text-foreground"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
