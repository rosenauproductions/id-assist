import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from "ai";
import { getLanguageModel, hasLanguageModel } from "@/lib/id/model";
import { loadProject } from "@/lib/id/store";
import { tutorSystemPrompt } from "@/lib/id/tutor-prompt";
import { assertAndConsumeGeneration } from "@/lib/billing/store";
import { requireWorkspaceContext } from "@/lib/team/store";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    messages: UIMessage[];
    projectId?: string;
  };
  const url = new URL(request.url);
  const projectId = body.projectId ?? url.searchParams.get("projectId");
  if (!projectId) {
    return Response.json({ error: "projectId required" }, { status: 400 });
  }

  const project = await loadProject(projectId);
  if (!project) {
    return Response.json({ error: "Project not found" }, { status: 404 });
  }
  if (project.outline.status !== "approved") {
    return Response.json(
      { error: "Approve the outline before tutoring." },
      { status: 409 },
    );
  }
  if (!hasLanguageModel()) {
    return Response.json(
      {
        error:
          "Configure a model in .env.local (OPENAI_API_KEY, ANTHROPIC_API_KEY, OLLAMA_MODEL, or AI_GATEWAY_API_KEY).",
      },
      { status: 503 },
    );
  }

  try {
    const context = await requireWorkspaceContext();
    await assertAndConsumeGeneration(context.workspaceId);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Not authorized." },
      { status: 402 },
    );
  }

  const result = streamText({
    model: await getLanguageModel(),
    system: tutorSystemPrompt(project),
    messages: await convertToModelMessages(body.messages),
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });
}
