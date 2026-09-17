import type { ComponentType, SVGProps } from "react";
import {
  PencilSquareIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ArrowPathIcon,
  PaperAirplaneIcon,
  MinusCircleIcon,
} from "@heroicons/react/16/solid";

// One status vocabulary, shared everywhere a status shows up: outline gate
// status (draft/needs_review/approved), interview sessions
// (in_progress/submitted/completed), and phase timeline cards
// (not_started/in_progress/blocked/done). Centralized so every status pill
// and badge in the app carries the same icon + tone for the same word,
// instead of four near-duplicate components drifting apart.

type StatusMeta = {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  tone: string;
};

const STATUS_META: Record<string, StatusMeta> = {
  draft: { icon: PencilSquareIcon, tone: "bg-muted/10 text-muted" },
  needs_review: { icon: ExclamationTriangleIcon, tone: "bg-warn/10 text-warn" },
  approved: { icon: CheckCircleIcon, tone: "bg-accent/10 text-accent" },
  in_progress: { icon: ArrowPathIcon, tone: "bg-muted/10 text-muted" },
  submitted: { icon: PaperAirplaneIcon, tone: "bg-warn/10 text-warn" },
  completed: { icon: CheckCircleIcon, tone: "bg-accent/10 text-accent" },
  not_started: { icon: MinusCircleIcon, tone: "bg-muted/10 text-muted" },
  blocked: { icon: ExclamationTriangleIcon, tone: "bg-danger/10 text-danger" },
  done: { icon: CheckCircleIcon, tone: "bg-accent/10 text-accent" },
  // Ticket statuses (src/lib/tickets/store.ts). "in_progress" above is
  // shared with the phase timeline.
  open: { icon: ExclamationTriangleIcon, tone: "bg-warn/10 text-warn" },
  resolved: { icon: CheckCircleIcon, tone: "bg-accent/10 text-accent" },
  closed: { icon: MinusCircleIcon, tone: "bg-muted/10 text-muted" },
};

const FALLBACK_META: StatusMeta = {
  icon: MinusCircleIcon,
  tone: "bg-muted/10 text-muted",
};

function getStatusMeta(status: string): StatusMeta {
  return STATUS_META[status] ?? FALLBACK_META;
}

export function StatusPill({ status }: { status: string }) {
  const { icon: Icon, tone } = getStatusMeta(status);
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide ${tone}`}
    >
      <Icon className="h-3 w-3" />
      {status.replace("_", " ")}
    </span>
  );
}

export function StatusIcon({
  status,
  className = "h-4 w-4",
}: {
  status: string;
  className?: string;
}) {
  const { icon: Icon } = getStatusMeta(status);
  return <Icon className={className} aria-hidden="true" />;
}
