"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signupAction } from "./actions";

export function SignupForm() {
  const [error, formAction, pending] = useActionState(signupAction, undefined);

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
          minLength={8}
          autoComplete="new-password"
          className="field"
        />
        <span className="text-xs font-normal text-muted">At least 8 characters.</span>
      </label>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="btn-primary w-fit disabled:opacity-50"
      >
        {pending ? "Creating account…" : "Create account"}
      </button>
      <p className="text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="text-accent underline-offset-2 hover:underline">
          Sign in
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
