import { loadProject } from "@/lib/id/store";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; filename: string }> },
) {
  const { id, filename } = await context.params;
  if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
    return new Response("Invalid filename", { status: 400 });
  }

  const project = await loadProject(id);
  if (!project) return new Response("Project not found", { status: 404 });

  const artifact = project.artifacts.find((item) => item.filename === filename);
  if (!artifact) return new Response("Artifact not found", { status: 404 });

  return new Response(artifact.body, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  });
}
