import Link from "next/link";
import { countOpenTickets } from "@/lib/tickets/store";

// One tab bar shared by every top-level page under /admin, so moving
// between Accounts/Tickets/Login map/Settings/Audit log reads as one
// section with sub-views rather than five loosely-linked pages. Each page
// passes its own id as `active`; the bar itself queries its own open-ticket
// count (rather than making all five pages fetch and pass it down) so a
// platform admin sees there's something waiting in Tickets no matter which
// admin page they land on first.

const ADMIN_TABS = [
  { id: "accounts", href: "/admin", label: "Accounts" },
  { id: "tickets", href: "/admin/tickets", label: "Tickets" },
  { id: "logins", href: "/admin/logins", label: "Login map" },
  { id: "settings", href: "/admin/settings", label: "Settings" },
  { id: "audit", href: "/admin/audit", label: "Audit log" },
] as const;

export type AdminTabId = (typeof ADMIN_TABS)[number]["id"];

export async function AdminTabs({ active }: { active: AdminTabId }) {
  const openTicketCount = await countOpenTickets();

  return (
    <div className="mt-3 flex flex-wrap gap-1 border-b border-line">
      {ADMIN_TABS.map((tab) => (
        <Link
          key={tab.id}
          href={tab.href}
          className={`-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
            active === tab.id
              ? "border-accent text-accent"
              : "border-transparent text-muted hover:border-line hover:text-foreground"
          }`}
        >
          {tab.label}
          {tab.id === "tickets" && openTicketCount > 0 ? (
            <span
              className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold leading-none text-white"
              title={`${openTicketCount} ticket${openTicketCount === 1 ? "" : "s"} awaiting resolution`}
            >
              {openTicketCount > 99 ? "99+" : openTicketCount}
            </span>
          ) : null}
        </Link>
      ))}
    </div>
  );
}
