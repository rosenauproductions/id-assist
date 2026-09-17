import type { LoginEventPoint } from "@/lib/admin/login-events";

// A plain table, not a graphic — an earlier version of this plotted logins
// as dots on a hand-drawn world map, but with only a handful of logins the
// dots read as unexplained circles with no context. A sortable-by-recency
// list of who/where/when is easier to actually read at this scale, and it
// degrades gracefully to "no location" for a login whose IP couldn't be
// resolved, instead of just dropping the point.

function locationLabel(event: LoginEventPoint): string {
  const parts = [event.city, event.region, event.country].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "Unknown location";
}

export function LoginTable({ events }: { events: LoginEventPoint[] }) {
  if (events.length === 0) {
    return (
      <div className="rounded-xl border border-line bg-card p-6 text-center text-sm text-muted">
        No logins in this window yet.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-card">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
            <th className="px-4 py-2.5 font-medium">Who</th>
            <th className="px-4 py-2.5 font-medium">Account</th>
            <th className="px-4 py-2.5 font-medium">Location</th>
            <th className="px-4 py-2.5 font-medium">When</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => (
            <tr key={event.id} className="border-b border-line last:border-0">
              <td className="px-4 py-2.5">{event.email ?? "Unknown"}</td>
              <td className="px-4 py-2.5 text-muted">
                {event.workspaceName ?? "—"}
              </td>
              <td className="px-4 py-2.5 text-muted">{locationLabel(event)}</td>
              <td className="px-4 py-2.5 text-muted">
                {new Date(event.createdAt).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
