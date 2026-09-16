import {
  evaluateWizardField,
  type BriefDraft,
  type FieldEvaluation,
  type WizardStepId,
} from "./brief-validate";

export type DevelopQuestion = {
  id: string;
  prompt: string;
  placeholder: string;
};

export type FieldCoachPlan = {
  questions: DevelopQuestion[];
  compose: (answers: Record<string, string>, draft: BriefDraft) => string;
};

const HOLLOW =
  /\b(understand|know|learn|be aware|appreciate|be familiar with|gain knowledge)\b/i;
const TOPIC_ONLY =
  /\b(overview|introduction to|basics of|fundamentals of|awareness of|about)\b/i;

function clean(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function sentenceCase(value: string): string {
  const trimmed = clean(value);
  if (!trimmed) return "";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function stripLeadingVerb(value: string): string {
  return clean(value).replace(
    /^(to\s+)?(write|create|build|run|perform|diagnose|critique|select|decide|complete|submit|configure|troubleshoot|facilitate|coach|draft|revise|approve|identify|classify|calculate|demonstrate|apply|analyze|evaluate|do)\b[\s,]*/i,
    "",
  );
}

export const FIELD_COACH: Record<WizardStepId, FieldCoachPlan> = {
  title: {
    questions: [
      {
        id: "performance",
        prompt: "What job performance should the title name?",
        placeholder: "writing a blameless PIR",
      },
      {
        id: "context",
        prompt: "Any tool, role, or situation to include?",
        placeholder: "for incident commanders",
      },
    ],
    compose: (answers) => {
      const performance = stripLeadingVerb(answers.performance || "");
      const context = clean(answers.context || "");
      if (!performance) return "";
      const core = sentenceCase(performance);
      return context ? `${core} ${context}` : core;
    },
  },
  audience: {
    questions: [
      {
        id: "role",
        prompt: "What job title or function is primary?",
        placeholder: "engineering leads",
      },
      {
        id: "level",
        prompt: "What experience level or tenure?",
        placeholder: "1+ year on-call",
      },
      {
        id: "context",
        prompt: "Where or when do they do this work?",
        placeholder: "during Sev-2 incident reviews",
      },
    ],
    compose: (answers) => {
      const role = clean(answers.role || "");
      const level = clean(answers.level || "");
      const context = clean(answers.context || "");
      if (!role) return "";
      const parts = [sentenceCase(role)];
      if (level) parts.push(`with ${level}`);
      if (context) parts.push(context.startsWith("during") || context.startsWith("in ") ? context : `in ${context}`);
      return parts.join(" ");
    },
  },
  jobTask: {
    questions: [
      {
        id: "action",
        prompt: "What observable action will they perform? (start with a verb you could watch)",
        placeholder: "write / configure / critique / select…",
      },
      {
        id: "product",
        prompt: "What finished work product or result proves success?",
        placeholder: "a facts-only post-incident review",
      },
      {
        id: "condition",
        prompt: "What inputs, tools, or situation will they have?",
        placeholder: "a Sev-2 timeline and chat export",
      },
      {
        id: "criterion",
        prompt: "What standard separates pass from fail?",
        placeholder: "no blame language; facts and decisions only",
      },
    ],
    compose: (answers) => {
      const action = clean(answers.action || "");
      const product = stripLeadingVerb(answers.product || "");
      const condition = clean(answers.condition || "");
      const criterion = clean(answers.criterion || "");
      if (!action && !product) return "";

      const verbPhrase = action
        ? sentenceCase(action)
        : product
          ? `Complete ${product}`
          : "";

      let draft = verbPhrase;
      if (product && action && !action.toLowerCase().includes(product.toLowerCase().slice(0, 12))) {
        draft = `${verbPhrase} ${product}`;
      } else if (product && !action) {
        draft = sentenceCase(`produce ${product}`);
      }

      if (condition) {
        const cond = /^(given|using|with|from|after|when|during)\b/i.test(condition)
          ? condition
          : `Given ${condition}`;
        draft = `${sentenceCase(cond)}, ${draft.charAt(0).toLowerCase()}${draft.slice(1)}`;
      }
      if (criterion) {
        draft = `${draft} to the standard: ${criterion}`;
      }
      return clean(draft);
    },
  },
  whyNow: {
    questions: [
      {
        id: "problem",
        prompt: "What is going wrong at work today?",
        placeholder: "blame language in PIRs",
      },
      {
        id: "cost",
        prompt: "What risk, cost, delay, or harm does that cause?",
        placeholder: "incident reporting drops",
      },
      {
        id: "urgency",
        prompt: "Why does this matter now (not next quarter)?",
        placeholder: "Sev-2 volume jumped this quarter",
      },
    ],
    compose: (answers) => {
      const problem = clean(answers.problem || "");
      const cost = clean(answers.cost || "");
      const urgency = clean(answers.urgency || "");
      if (!problem && !cost) return "";
      const parts: string[] = [];
      if (problem && cost) {
        parts.push(`${sentenceCase(problem)} is causing ${cost}`);
      } else if (problem) {
        parts.push(sentenceCase(problem));
      } else {
        parts.push(sentenceCase(cost));
      }
      if (urgency) parts.push(urgency);
      return parts.join(". ") + (parts.length ? "." : "");
    },
  },
  durationMinutes: {
    questions: [
      {
        id: "depth",
        prompt: "Is this a micro tip, a focused practice course, or a deep workshop?",
        placeholder: "focused practice course",
      },
      {
        id: "practice",
        prompt: "How many minutes of practice + feedback do they need?",
        placeholder: "15",
      },
    ],
    compose: (answers) => {
      const practice = Number(clean(answers.practice || ""));
      if (Number.isFinite(practice) && practice > 0) {
        return String(Math.min(120, Math.max(10, Math.round(practice + 10))));
      }
      const depth = clean(answers.depth || "").toLowerCase();
      if (depth.includes("micro")) return "12";
      if (depth.includes("workshop") || depth.includes("deep")) return "60";
      return "25";
    },
  },
  constraints: {
    questions: [
      {
        id: "modality",
        prompt: "Any modality limits? (async only, no live workshop, no video…)",
        placeholder: "async only, no live workshop",
      },
      {
        id: "tools",
        prompt: "Tools, devices, language, or compliance limits?",
        placeholder: "must work on mobile; English only",
      },
      {
        id: "none",
        prompt: "If truly none, type “none”. Otherwise leave blank.",
        placeholder: "none",
      },
    ],
    compose: (answers) => {
      if (/^none$/i.test(clean(answers.none || ""))) return "None";
      const parts = [answers.modality, answers.tools]
        .map(clean)
        .filter(Boolean);
      return parts.length ? parts.join("; ") : "None";
    },
  },
  delivery: {
    questions: [
      {
        id: "primary",
        prompt: "Where will most learners encounter this?",
        placeholder: "Rise / Canvas / Doc / Slides / Video / Tutor",
      },
      {
        id: "secondary",
        prompt: "Any secondary channel worth shipping too?",
        placeholder: "job aid in Google Doc",
      },
    ],
    compose: () => "",
  },
};

export function looksStuckOnField(
  step: WizardStepId,
  draft: BriefDraft,
  evaluation?: FieldEvaluation | null,
  attempts = 0,
): boolean {
  const evalResult = evaluation ?? evaluateWizardField(step, draft);
  if (step === "delivery") return !draft.delivery.length;
  if (step === "durationMinutes") {
    return !evalResult.ok && attempts >= 1;
  }

  const value = String(draft[step] ?? "").trim();

  if (!value) return true;
  if (value.length < 12 && step !== "constraints") return true;
  if (attempts >= 2 && !evalResult.ok) return true;
  if (HOLLOW.test(value) || (TOPIC_ONLY.test(value) && !evalResult.ok)) return true;
  if (evalResult.clarifyingQuestions.length >= 2 && !evalResult.ok) return true;
  return false;
}

export function suggestRewrites(
  step: WizardStepId,
  draft: BriefDraft,
): string[] {
  const suggestions = new Set<string>();
  const value =
    step === "durationMinutes"
      ? String(draft.durationMinutes)
      : step === "delivery"
        ? draft.delivery.join(", ")
        : String(draft[step] ?? "").trim();

  if (step === "jobTask") {
    if (HOLLOW.test(value)) {
      const topic = value
        .replace(HOLLOW, "")
        .replace(/\b(the|a|an|to|of|about|how to)\b/gi, " ")
        .replace(/\s+/g, " ")
        .trim();
      const focus = topic || draft.title || "the required task";
      suggestions.add(`Given a real work scenario, demonstrate ${focus} to a checkable standard`);
      suggestions.add(`Produce a finished work product for ${focus} using the tools they have on the job`);
      if (draft.audience) {
        suggestions.add(
          `As a ${draft.audience.split(/[,.]/)[0].trim()}, complete ${focus} without coaching`,
        );
      }
    } else if (value && !/\b(from|using|given|with|after|during|when)\b/i.test(value)) {
      suggestions.add(`Given the tools and inputs from their real job, ${value.charAt(0).toLowerCase()}${value.slice(1)}`);
      if (draft.whyNow) {
        suggestions.add(
          `${value.replace(/\.$/, "")} in a way that addresses: ${draft.whyNow.split(/[.!]/)[0].trim()}`,
        );
      }
    } else if (value.length >= 16) {
      suggestions.add(
        value.replace(/\.$/, "") + " to a standard a peer could score pass/fail",
      );
    }

    if (!value && draft.title) {
      const fromTitle = draft.title.replace(/^(how to|intro to|introduction to)\s+/i, "");
      suggestions.add(`Given typical on-the-job inputs, successfully ${fromTitle.charAt(0).toLowerCase()}${fromTitle.slice(1)}`);
    }
  }

  if (step === "title") {
    if (draft.jobTask) {
      const task = draft.jobTask
        .replace(/^(given|using|with|from|after|when|during)\b[^,]*,\s*/i, "")
        .split(/\s+to the standard/i)[0]
        .trim();
      if (task.length > 8 && task.length < 80) {
        suggestions.add(sentenceCase(task));
      }
    }
    if (TOPIC_ONLY.test(value) || /^(new course|course|training|module)\b/i.test(value)) {
      suggestions.add(value.replace(TOPIC_ONLY, "").trim() || "Performing the target job task");
    }
  }

  if (step === "audience") {
    if (/^(everyone|all staff|employees|users|people|team)\b/i.test(value) || value.length < 12) {
      if (draft.jobTask) {
        suggestions.add(
          `People who must ${draft.jobTask.split(/[,.]/)[0].trim().replace(/^(given|using)\b[^,]*,\s*/i, "").toLowerCase()}`,
        );
      }
      suggestions.add("New hires in their first 90 days who own this task");
      suggestions.add("Frontline practitioners who do this weekly, not executives");
    }
  }

  if (step === "whyNow") {
    if (value.length < 30 || /^(because|required|compliance|mandatory|leadership asked)\b/i.test(value)) {
      if (draft.jobTask) {
        suggestions.add(
          `Without this, people fail at: ${draft.jobTask.split(/[,.]/)[0].trim()}`,
        );
      }
      suggestions.add(
        "Current practice creates avoidable errors, delays, or risk that leadership is seeing now",
      );
    }
  }

  if (step === "constraints" && !value) {
    suggestions.add("None");
    suggestions.add("Async only; no live workshop");
    suggestions.add("Must work on mobile; no required video");
  }

  if (step === "durationMinutes") {
    const minutes = draft.durationMinutes;
    if (minutes > 0 && minutes < 10) suggestions.add("15");
    if (minutes > 120) suggestions.add("45");
    if (!minutes) suggestions.add("25");
  }

  return [...suggestions].filter(Boolean).slice(0, 3);
}

export function enrichEvaluation(
  step: WizardStepId,
  draft: BriefDraft,
  attempts = 0,
): FieldEvaluation {
  const base = evaluateWizardField(step, draft);
  const suggestedRewrites = suggestRewrites(step, draft);
  return {
    ...base,
    suggestedRewrites,
    looksStuck: looksStuckOnField(step, draft, base, attempts),
  };
}

export function composeFieldFromAnswers(
  step: WizardStepId,
  answers: Record<string, string>,
  draft: BriefDraft,
): string {
  return FIELD_COACH[step].compose(answers, draft);
}
