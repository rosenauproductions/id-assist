"use client";

import { useState } from "react";

export function InviteLinkRow({ token, email }: { token: string; email: string }) {
  const [copied, setCopied] = useState(false);

  function copyLink() {
    // Computed on click, not at render time — avoids a server/client
    // hydration mismatch from window.location.origin differing between
    // the server render and the browser (see interview-workspace.tsx's
    // earlier bug for what happens when this is done at render time).
    const link = `${window.location.origin}/signup?invite=${token}`;
    navigator.clipboard
      .writeText(link)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {
        // Clipboard access can be denied — the token is still visible in
        // the DOM below for the admin to select and copy manually.
      });
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed border-line bg-background px-3 py-2 text-sm">
      <div className="min-w-0">
        <p className="font-medium">{email}</p>
        <p className="truncate text-xs text-muted">invite pending · /signup?invite={token}</p>
      </div>
      <button
        type="button"
        onClick={copyLink}
        className="shrink-0 rounded-md border border-line px-3 py-1.5 text-xs font-medium hover:border-accent/40"
      >
        {copied ? "Copied!" : "Copy link"}
      </button>
    </li>
  );
}
