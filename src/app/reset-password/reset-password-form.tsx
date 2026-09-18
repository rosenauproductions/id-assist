"use client";

import { useActionState } from "react";
import { resetPasswordAction } from "./actions";

export function ResetPasswordForm({ token }: { token: string }) {
  const [error, formAction, pending] = useActionState(resetPasswordAction, undefined);

  return (
    <form action={formAction} className="mt-6 grid gap-4">
      <input type="hidden" name="token" value={token} />
      <label className="grid gap-1.5 text-sm font-medium">
        New password
        <input
          required
          name="newPassword"
          type="password"
          autoComplete="new-password"
          minLength={8}
          className="field"
          autoFocus
        />
      </label>
      <label className="grid gap-1.5 text-sm font-medium">
        Confirm new password
        <input
          required
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          minLength={8}
          className="field"
        />
      </label>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="btn-primary w-fit disabled:opacity-50"
      >
        {pending ? "Saving…" : "Set new password"}
      </button>
      <style>{`
        .field {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid var(--line);
          background: var(--background);
          padding: 0.55rem 0.75rem;
        }
        .btn-primary {
          border-radius: 0.5rem;
          background: var(--foreground);
          color: var(--background);
          padding: 0.55rem 0.95rem;
          font-size: 0.875rem;
          font-weight: 600;
        }
      `}</style>
    </form>
  );
}
