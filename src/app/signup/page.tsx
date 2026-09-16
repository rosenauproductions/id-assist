import { SignupForm } from "./signup-form";

export default function SignupPage() {
  return (
    <main className="mx-auto max-w-sm px-6 py-16">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-accent">
        ID Assist
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Create an account</h1>
      <SignupForm />
    </main>
  );
}
