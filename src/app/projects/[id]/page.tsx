import { loadProject } from "@/lib/id/store";
import { notFound } from "next/navigation";
import { ProjectWorkspace } from "./project-workspace";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await loadProject(id);
  if (!project) notFound();
  return <ProjectWorkspace project={project} />;
}
