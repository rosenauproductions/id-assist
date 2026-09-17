import { getInterviewSessionByToken } from "@/lib/interview/store";
import { InterviewLinkForm } from "./interview-link-form";

export default async function InterviewLinkPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const session = await getInterviewSessionByToken(token);

  if (!session) {
    return (
      <main className="mx-auto max-w-xl px-6 py-16 text-center">
        <p className="text-sm text-muted">This interview link isn&apos;t valid.</p>
      </main>
    );
  }

  if (session.status === "completed") {
    return (
      <main className="mx-auto max-w-xl px-6 py-16 text-center">
        <p className="text-sm text-muted">
          This interview has already been used to build a course. Thanks for
          your time.
        </p>
      </main>
    );
  }

  return (
    <InterviewLinkForm
      token={token}
      initialAnswers={session.answers}
      initialSubmitted={session.status === "submitted"}
      courseWorkingTitle={session.courseWorkingTitle}
    />
  );
}
