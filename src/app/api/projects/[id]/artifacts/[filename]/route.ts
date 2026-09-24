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

  // Tutor-bot exports (see generateArtifacts() in adapters.ts) are real
  // self-contained HTML pages, not markdown — serve them with the right
  // content type so they render as a page instead of downloading as text.
  const contentType = filename.endsWith(".html")
    ? "text/html; charset=utf-8"
    : "text/markdown; charset=utf-8";

  return new Response(artifact.body, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  });
}
