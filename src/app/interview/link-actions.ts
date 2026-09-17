"use server";

// Public, token-based actions for the SME's own share link
// (/interview/link/[token]) — deliberately separate from actions.ts, whose
// functions all go through requireWorkspaceContext(). Nothing here relies
// on auth() at all; the unguessable token is the only credential, same
// trust model as an invitations.token accept link.

import {
  markInterviewSubmittedByToken,
  saveInterviewAnswersByToken,
  type InterviewAnswers,
} from "@/lib/interview/store";

export async function saveInterviewLinkAnswersAction(
  token: string,
  answers: InterviewAnswers,
): Promise<void> {
  await saveInterviewAnswersByToken(token, answers);
}

export async function submitInterviewLinkAction(token: string): Promise<void> {
  await markInterviewSubmittedByToken(token);
}
