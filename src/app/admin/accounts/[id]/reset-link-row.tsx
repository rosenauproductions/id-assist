"use client";

import { useState } from "react";

export function ResetLinkRow({ token, email }: { token: string; email: string }) {
  const [copied, setCopied] = useState(false);

  function copyLink() {
    // Computed on click, not at render time — same origin-hydration
    // rationale as InviteLinkRow's copyLink.
    const link = `${window.location.origin}/reset-password?token=${token}`;
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
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed border-warn/40 bg-background px-3 py-2 text-sm">
      <div className="min-w-0">
        <p className="font-medium">{email}</p>
        <p className="truncate text-xs text-muted">
          password reset pending · expires in 24h · /reset-password?token={token}
        </p>
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
