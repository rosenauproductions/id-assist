import { loadProject } from "@/lib/id/store";
import { notFound } from "next/navigation";
import { TutorChat } from "./tutor-chat";

export default async function TutorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await loadProject(id);
  if (!project) notFound();
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-3xl flex-col px-6 py-8">
      <p className="text-xs uppercase tracking-wide text-muted">Live tutor</p>
      <h1 className="text-2xl tracking-tight">{project.outline.brief.title}</h1>
      <p className="mt-1 text-sm text-muted">
        Teaches the approved outline. Apply and above still need an artifact.
      </p>
      <TutorChat
        projectId={project.id}
        approved={project.outline.status === "approved"}
        courseTitle={project.outline.brief.title}
      />
    </main>
  );
}
