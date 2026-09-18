import { loadProject } from "@/lib/id/store";
import { getMapShapes } from "@/lib/settings/store";
import { notFound } from "next/navigation";
import { ProjectWorkspace } from "./project-workspace";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [project, mapShapes] = await Promise.all([
    loadProject(id),
    getMapShapes(),
  ]);
  if (!project) notFound();
  return <ProjectWorkspace project={project} mapShapes={mapShapes} />;
}
