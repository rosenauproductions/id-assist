"use client";

import { useEffect, useRef, useState } from "react";
import {
  saveTutorBotContentAction,
  saveTutorBotExportAction,
} from "@/app/actions";
import type { IdProject, Lesson } from "@/lib/id/types";

// Full-screen host for the Knowledge Creator tool (public/tutor-builder/),
// bridged in over postMessage rather than ported to React — see the
// "ID Assist embedding bridge" block added to that file. The tool posts
// kt-ready once its own message listener is wired up (avoiding a race
// where we'd post kt-load before it could hear it), kt-save whenever the
// user clicks its "Save to ID Assist" button, and kt-exported once
// "Export Tutor" builds the self-contained HTML page.
export function TutorBotEditor({
  project,
  lesson,
  onClose,
}: {
  project: IdProject;
  lesson: Lesson;
  onClose: () => void;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const bot = project.outline.tutorBots.find(
    (item) => item.id === lesson.tutorBotId,
  );

  useEffect(() => {
    if (!bot) return;
    function onMessage(event: MessageEvent) {
      if (event.source !== iframeRef.current?.contentWindow) return;
      const msg = event.data as
        | { type?: string; data?: unknown; html?: string }
        | null;
      if (!msg || typeof msg !== "object" || !bot) return;

      if (msg.type === "kt-ready") {
        iframeRef.current?.contentWindow?.postMessage(
          {
            type: "kt-load",
            data: {
              title: bot.title,
              settings: bot.settings,
              concepts: bot.concepts,
              diagnostic: bot.diagnostic,
            },
          },
          "*",
        );
        return;
      }

      if (msg.type === "kt-save") {
        setStatus("saving");
        const formData = new FormData();
        formData.set("projectId", project.id);
        formData.set("tutorBotId", bot.id);
        formData.set("data", JSON.stringify(msg.data ?? {}));
        saveTutorBotContentAction(formData).then(() => {
          setStatus("saved");
          setTimeout(() => setStatus("idle"), 2000);
        });
        return;
      }

      if (msg.type === "kt-exported" && typeof msg.html === "string") {
        const formData = new FormData();
        formData.set("projectId", project.id);
        formData.set("tutorBotId", bot.id);
        formData.set("html", msg.html);
        void saveTutorBotExportAction(formData);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [project.id, bot]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  if (!bot) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="flex items-center justify-between border-b border-line bg-card px-4 py-2 text-sm">
        <p className="font-medium">
          Tutor bot — {lesson.title}
          {status === "saving" ? (
            <span className="ml-2 text-muted">Saving…</span>
          ) : null}
          {status === "saved" ? (
            <span className="ml-2 text-accent">Saved</span>
          ) : null}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="text-sm text-muted hover:text-foreground"
        >
          Close
        </button>
      </div>
      <iframe
        ref={iframeRef}
        src="/tutor-builder/knowledge-creator-v2.html"
        className="h-full w-full flex-1 border-0"
        title={`Tutor bot editor for ${lesson.title}`}
      />
    </div>
  );
}
