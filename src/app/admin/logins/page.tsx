import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/admin/store";
import { listLoginEvents, type LoginMapRange } from "@/lib/admin/login-events";
import { AdminTabs } from "@/components/admin-tabs";
import { LoginTable } from "@/components/login-map";

const RANGES: { id: LoginMapRange; label: string }[] = [
  { id: "day", label: "Today" },
  { id: "week", label: "This week" },
  { id: "month", label: "This month" },
];

function parseRange(value: string | undefined): LoginMapRange {
  return value === "day" || value === "week" || value === "month" ? value : "week";
}

export default async function AdminLoginsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  try {
    await requirePlatformAdmin();
  } catch {
    notFound();
  }

  const params = await searchParams;
  const range = parseRange(params.range);
  const events = await listLoginEvents(range);
  const located = events.filter(
    (event) => event.lat !== null && event.lng !== null,
  );
  const unlocated = events.length - located.length;

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <Link href="/admin" className="text-sm text-muted hover:text-foreground">
        ← Accounts
      </Link>
      <AdminTabs active="logins" />
      <p className="mt-4 text-xs font-medium uppercase tracking-[0.14em] text-accent">
        Platform admin
      </p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">
        Logins
      </h1>
      <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
        A snapshot of where logins have come from, as of right now — this
        doesn&apos;t auto-refresh, so reload the page for anything newer.
      </p>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {RANGES.map((option) => (
          <Link
            key={option.id}
            href={`/admin/logins?range=${option.id}`}
            className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
              range === option.id
                ? "border-accent bg-accent/10 text-accent"
                : "border-line text-muted hover:text-foreground"
            }`}
          >
            {option.label}
          </Link>
        ))}
      </div>

      <div className="mt-4">
        <LoginTable events={events} />
      </div>

      <p className="mt-3 text-xs text-muted">
        {located.length} of {events.length} login{events.length === 1 ? "" : "s"} had a
        resolvable location
        {unlocated > 0 ? ` · ${unlocated} from an unresolved IP` : ""}.
      </p>
    </main>
  );
}
