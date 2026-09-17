"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { StatusPill } from "@/components/status";
import type { TicketDetail, TicketStatus } from "@/lib/tickets/store";
import { TICKET_TYPE_LABELS } from "@/lib/tickets/scripts";

const STATUS_OPTIONS: TicketStatus[] = [
  "open",
  "in_progress",
  "resolved",
  "closed",
];

// Shared by the customer view (/tickets/[id]) and the admin view
// (/admin/tickets/[id]) — same transcript/messages/reply UI either way;
// only the status-change control and the reply action passed in differ.
export function TicketThread({
  ticket,
  onReply,
  onSetStatus,
}: {
  ticket: TicketDetail;
  onReply: (body: string) => Promise<void>;
  onSetStatus?: (status: TicketStatus) => Promise<void>;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [statusPending, startStatusTransition] = useTransition();

  function submitReply() {
    if (!body.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        await onReply(body);
        setBody("");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't send that.");
      }
    });
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill status={ticket.status} />
        <span className="text-xs uppercase tracking-wide text-muted">
          {TICKET_TYPE_LABELS[ticket.type]}
        </span>
        {onSetStatus ? (
          <select
            defaultValue={ticket.status}
            disabled={statusPending}
            onChange={(event) => {
              const next = event.target.value as TicketStatus;
              startStatusTransition(async () => {
                await onSetStatus(next);
                router.refresh();
              });
            }}
            className="ml-auto rounded-md border border-line bg-background px-2 py-1 text-xs"
          >
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {status.replace("_", " ")}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      <div className="mt-4 rounded-xl border border-line bg-card p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">
          Submitted{" "}
          {ticket.submittedByEmail ? `by ${ticket.submittedByEmail} ` : ""}
          {new Date(ticket.createdAt).toLocaleString()}
        </p>
        <div className="mt-3 grid gap-3">
          {ticket.transcript.map((entry, index) => (
            <div key={index}>
              <p className="text-sm font-medium">{entry.question}</p>
              <p className="mt-0.5 whitespace-pre-wrap text-sm text-muted">
                {entry.answer}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6">
        <p className="text-sm font-medium">Replies</p>
        <ul className="mt-2 grid gap-3">
          {ticket.messages.length === 0 ? (
            <li className="text-sm text-muted">No replies yet.</li>
          ) : (
            ticket.messages.map((message) => (
              <li
                key={message.id}
                className={`rounded-lg border p-3 text-sm ${
                  message.isAdminAuthor
                    ? "border-accent/30 bg-accent/5"
                    : "border-line bg-card"
                }`}
              >
                <p className="text-xs font-medium uppercase tracking-wide text-muted">
                  {message.isAdminAuthor ? "Support" : message.authorEmail ?? "Someone"}
                  {" · "}
                  {new Date(message.createdAt).toLocaleString()}
                </p>
                <p className="mt-1 whitespace-pre-wrap">{message.body}</p>
              </li>
            ))
          )}
        </ul>

        {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}

        <div className="mt-3 grid gap-2">
          <textarea
            rows={3}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Write a reply…"
            className="w-full rounded-lg border border-line bg-background px-3 py-2 text-sm"
          />
          <div>
            <button
              type="button"
              disabled={pending || !body.trim()}
              onClick={submitReply}
              className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
            >
              {pending ? "Sending…" : "Send reply"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
