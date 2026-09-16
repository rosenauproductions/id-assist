"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction } from "./actions";

export function LoginForm() {
  const [error, formAction, pending] = useActionState(loginAction, undefined);

  return (
    <form action={formAction} className="mt-6 grid gap-4">
      <label className="grid gap-1.5 text-sm font-medium">
        Email
        <input
          required
          name="email"
          type="email"
          autoComplete="email"
          className="field"
          autoFocus
        />
      </label>
      <label className="grid gap-1.5 text-sm font-medium">
        Password
        <input
          required
          name="password"
          type="password"
          autoComplete="current-password"
          className="field"
        />
      </label>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="btn-primary w-fit disabled:opacity-50"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
      <p className="text-sm text-muted">
        No account?{" "}
        <Link href="/signup" className="text-accent underline-offset-2 hover:underline">
          Sign up
        </Link>
      </p>
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
