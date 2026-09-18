import { ResetPasswordForm } from "./reset-password-form";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <main className="mx-auto max-w-sm px-6 py-16">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-accent">
        ID Assist
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">
        Set a new password
      </h1>
      {token ? (
        <>
          <p className="mt-2 text-sm text-muted">
            Choose a new password for your account. This link only works once.
          </p>
          <ResetPasswordForm token={token} />
        </>
      ) : (
        <p className="mt-2 text-sm text-danger">
          This link is missing its token — ask whoever sent it for a fresh one.
        </p>
      )}
    </main>
  );
}
