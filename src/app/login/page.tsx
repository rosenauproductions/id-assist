import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="mx-auto max-w-sm px-6 py-16">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-accent">
        ID Assist
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Sign in</h1>
      <p className="mt-2 text-sm text-muted">
        Your courses, your account — nobody else sees them.
      </p>
      <LoginForm />
    </main>
  );
}
