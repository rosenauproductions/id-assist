import Link from "next/link";
import { notFound } from "next/navigation";
import { listAuditLog, requirePlatformAdmin } from "@/lib/admin/store";
import { AdminTabs } from "@/components/admin-tabs";

const ACTION_LABEL: Record<string, string> = {
  create_account: "Created account",
  rename_account: "Renamed account",
  set_status_active: "Activated account",
  set_status_suspended: "Suspended account",
  set_status_canceled: "Canceled account",
  set_account_manager: "Set account manager",
  add_user_invite: "Invited user",
  add_note: "Added note",
  impersonate_start: "Started impersonating",
  impersonate_end: "Stopped impersonating",
};

export default async function AdminAuditPage() {
  try {
    await requirePlatformAdmin();
  } catch {
    notFound();
  }
  const entries = await listAuditLog();

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <Link href="/admin" className="text-sm text-muted hover:text-foreground">
        ← Accounts
      </Link>
      <AdminTabs active="audit" />
      <p className="mt-4 text-xs font-medium uppercase tracking-[0.14em] text-accent">
        Platform admin
      </p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">Audit log</h1>
      <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
        Every admin action against an account — who did it, to what, and
        when. Append-only.
      </p>

      <ul className="mt-6 grid gap-2">
        {entries.length === 0 ? (
          <li className="rounded-xl border border-dashed border-line bg-card/60 px-4 py-8 text-center text-sm text-muted">
            Nothing logged yet.
          </li>
        ) : (
          entries.map((entry) => (
            <li
              key={entry.id}
              className="rounded-md border border-line bg-card px-3 py-2 text-sm"
            >
              <p className="font-medium">
                {ACTION_LABEL[entry.action] ?? entry.action}
                {entry.targetWorkspaceName ? ` · ${entry.targetWorkspaceName}` : ""}
                {entry.targetUserEmail ? ` · ${entry.targetUserEmail}` : ""}
              </p>
              <p className="mt-0.5 text-xs text-muted">
                {entry.actorEmail ?? "Unknown admin"} ·{" "}
                {new Date(entry.createdAt).toLocaleString()}
                {entry.metadata?.reason
                  ? ` · "${String(entry.metadata.reason)}"`
                  : ""}
              </p>
            </li>
          ))
        )}
      </ul>
    </main>
  );
}
