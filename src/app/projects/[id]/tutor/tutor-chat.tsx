"use client";

import { DefaultChatTransport } from "ai";
import { useChat } from "@ai-sdk/react";
import { useMemo, useState } from "react";
import Link from "next/link";

export function TutorChat({
  projectId,
  approved,
  courseTitle,
}: {
  projectId: string;
  approved: boolean;
  courseTitle: string;
}) {
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: `/api/tutor?projectId=${projectId}`,
      }),
    [projectId],
  );
  const { messages, sendMessage, status, error } = useChat({ transport });
  const [input, setInput] = useState("");
  const busy = status === "submitted" || status === "streaming";

  if (!approved) {
    return (
      <div className="mt-8 rounded-xl border border-warn/30 bg-warn/5 px-4 py-6 text-sm">
        Approve the outline first so the tutor stays inside the curriculum.{" "}
        <Link href={`/projects/${projectId}`} className="font-medium text-accent">
          Back to outline
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-6 flex min-h-[60vh] flex-1 flex-col rounded-xl border border-line bg-card">
      <div className="border-b border-line px-4 py-3">
        <p className="text-xs uppercase tracking-wide text-muted">Local Ollama tutor</p>
        <p className="font-medium">{courseTitle}</p>
      </div>
      <div className="flex-1 space-y-4 overflow-auto px-4 py-4">
        {messages.length === 0 ? (
          <p className="text-sm text-muted">
            Start with a real work sample, or ask how lesson 1 begins.
          </p>
        ) : null}
        {messages.map((message) => (
          <article
            key={message.id}
            className={
              message.role === "user"
                ? "ml-8 rounded-lg bg-background px-3 py-2"
                : "mr-8 rounded-lg border border-line px-3 py-2"
            }
          >
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
              {message.role === "user" ? "You" : "Tutor"}
            </p>
            {message.parts.map((part, index) =>
              part.type === "text" ? (
                <p key={index} className="mt-1 whitespace-pre-wrap text-sm leading-6">
                  {part.text}
                </p>
              ) : null,
            )}
          </article>
        ))}
        {busy ? <p className="text-sm text-muted">Tutor is thinking…</p> : null}
        {error ? <p className="text-sm text-danger">{error.message}</p> : null}
      </div>
      <form
        className="flex gap-2 border-t border-line px-4 py-3"
        onSubmit={(event) => {
          event.preventDefault();
          const text = input.trim();
          if (!text || busy) return;
          sendMessage({ text });
          setInput("");
        }}
      >
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          disabled={busy}
          className="min-w-0 flex-1 rounded-md border border-line bg-background px-3 py-2 text-sm"
          placeholder="Paste a draft, or ask how to start."
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </div>
  );
}
