"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { DELIVERY_TARGETS } from "@/lib/id/types";
import { briefReady, type BriefDraft } from "@/lib/id/brief-validate";
import { compileBrief } from "@/lib/id/compile";
import { saveProject } from "@/lib/id/store";
import {
  completeInterviewSession,
  createInterviewSession,
  deleteInterviewSession,
  saveInterviewAnswers,
  type InterviewAnswers,
} from "@/lib/interview/store";

export async function createInterviewAction(formData: FormData) {
  const id = await createInterviewSession({
    smeName: String(formData.get("smeName") ?? ""),
    courseWorkingTitle: String(formData.get("courseWorkingTitle") ?? ""),
  });
  redirect(`/interview/${id}`);
}

export async function saveInterviewAnswersAction(
  id: string,
  answers: InterviewAnswers,
): Promise<void> {
  await saveInterviewAnswers(id, answers);
  revalidatePath(`/interview/${id}`);
}

/**
 * Same validation and compile step as createProjectFromDraftAction (the
 * wizard's hand-off) — the interview never bypasses the quality bar every
 * other intake path already has to clear. The only addition is marking the
 * interview session completed and linking it to the new project.
 */
export async function createProjectFromInterviewAction(
  sessionId: string,
  draft: BriefDraft,
): Promise<string> {
  if (!briefReady(draft)) {
    throw new Error(
      "This brief still needs some fixes — go back to the review step and clear them before creating the project.",
    );
  }
  const project = compileBrief({
    title: draft.title.trim(),
    audience: draft.audience.trim(),
    jobTask: draft.jobTask.trim(),
    whyNow: draft.whyNow.trim(),
    durationMinutes: draft.durationMinutes || 25,
    constraints: draft.constraints.trim() || "None",
    delivery: draft.delivery.length ? draft.delivery : [...DELIVERY_TARGETS],
  });
  await saveProject(project);
  await completeInterviewSession(sessionId, project.id);
  revalidatePath("/interview");
  return project.id;
}

export async function deleteInterviewSessionAction(id: string) {
  await deleteInterviewSession(id);
  revalidatePath("/interview");
}
