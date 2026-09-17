import Link from "next/link";
import { notFound } from "next/navigation";
import { listAccounts, requirePlatformAdmin } from "@/lib/admin/store";
import { StatusPill } from "@/components/status";
import { createAccountAction } from "./actions";

export default async function AdminPage() {
  try {
    await requirePlatformAdmin();
  } catch {
    notFound();
  }
  const accounts = await listAccounts();

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <Link href="/app" className="text-sm text-muted hover:text-foreground">
        ← Home
      </Link>
      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-accent">
            Platform admin
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            Accounts
          </h1>
        </div>
        <Link
          href="/admin/audit"
          className="text-sm text-muted hover:text-foreground"
        >
          Audit log →
        </Link>
      </div>
      <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
        Every account on the platform — schools, agencies, and solo
        freelancers alike. Add one, or open an existing account to manage its
        users, status, and account manager.
      </p>

      <section className="mt-6 rounded-xl border border-line bg-card p-5">
        <h2 className="text-lg font-semibold">Add an account</h2>
        <p className="mt-1 text-sm text-muted">
          Creates a new account on a 14-day trial and a pending owner invite
          you can send them — for onboarding someone yourself rather than
          them signing up on their own.
        </p>
        <form action={createAccountAction} className="mt-4 grid gap-3 sm:grid-cols-[1.5fr_1.5fr_auto]">
          <input
            name="name"
            required
            placeholder="Account name (e.g. Riverside Fire Dept.)"
            className="field"
          />
          <input
            name="ownerEmail"
            type="email"
            required
            placeholder="Owner's email"
            className="field"
          />
          <button
            type="submit"
            className="rounded-md bg-foreground px-4 py-2.5 text-sm font-medium text-background"
          >
            Create
          </button>
        </form>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-medium uppercase tracking-[0.14em] text-muted">
          {accounts.length} account{accounts.length === 1 ? "" : "s"}
        </h2>
        <ul className="mt-3 grid gap-2">
          {accounts.length === 0 ? (
            <li className="rounded-xl border border-dashed border-line bg-card/60 px-4 py-8 text-center text-sm text-muted">
              No accounts yet.
            </li>
          ) : (
            accounts.map((account) => (
              <li key={account.id}>
                <Link
                  href={`/admin/accounts/${account.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-card px-4 py-3 text-sm hover:border-accent/40"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{account.name}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {account.memberCount} member
                      {account.memberCount === 1 ? "" : "s"} ·{" "}
                      {account.projectCount} project
                      {account.projectCount === 1 ? "" : "s"} ·{" "}
                      {account.accountManagerLabel ?? "Unassigned"}
                    </p>
                  </div>
                  <StatusPill status={account.status} />
                </Link>
              </li>
            ))
          )}
        </ul>
      </section>
      <style>{`
        .field {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid var(--line);
          background: var(--background);
          padding: 0.55rem 0.75rem;
        }
        .field:focus {
          outline: 2px solid color-mix(in oklab, var(--accent) 35%, transparent);
          outline-offset: 1px;
        }
      `}</style>
    </main>
  );
}
