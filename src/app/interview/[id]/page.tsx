import { notFound, redirect } from "next/navigation";
import { getInterviewSession } from "@/lib/interview/store";
import { getWorkspaceSettings } from "@/lib/settings/store";
import { DELIVERY_TARGETS } from "@/lib/id/types";
import { InterviewWorkspace } from "./interview-workspace";

export default async function InterviewSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getInterviewSession(id);
  if (!session) notFound();
  if (session.status === "completed" && session.projectId) {
    redirect(`/projects/${session.projectId}`);
  }

  const workspace = await getWorkspaceSettings();
  const defaultDelivery = workspace?.defaultDelivery ?? [...DELIVERY_TARGETS];

  return <InterviewWorkspace session={session} defaultDelivery={defaultDelivery} />;
}
