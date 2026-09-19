import { DELIVERY_TARGETS, type DeliveryTarget } from "./types";

export type WizardStepId =
  | "title"
  | "audience"
  | "jobTask"
  | "whyNow"
  | "durationMinutes"
  | "constraints"
  | "delivery";

export type BriefDraft = {
  title: string;
  audience: string;
  jobTask: string;
  whyNow: string;
  durationMinutes: number;
  constraints: string;
  delivery: DeliveryTarget[];
};

export type FieldEvaluation = {
  ok: boolean;
  score: number;
  summary: string;
  issues: string[];
  clarifyingQuestions: string[];
  rewriteHints: string[];
  suggestedRewrites?: string[];
  looksStuck?: boolean;
};

const TOPIC_ONLY =
  /\b(overview|introduction to|basics of|fundamentals of|awareness of|about)\b/i;
const HOLLOW =
  /\b(understand|know|learn|be aware|appreciate|be familiar with|gain knowledge)\b/i;
const OBSERVABLE =
  /\b(write|create|build|run|perform|diagnose|critique|select|decide|complete|submit|configure|troubleshoot|facilitate|coach|draft|revise|approve|identify|classify|calculate|demonstrate|apply|analyze|evaluate|explain|describe|present|respond|reply|resolve|recommend|document|summarize|outline|generate|produce|deliver|review|assess|plan|design|address|handle|process|escalate|prioritize|verify|validate|inspect|measure|compose|edit|format|negotiate|greet|close|pitch|counsel|advise|guide|instruct|operate|execute|implement|install|deploy|test|debug|fix|repair|calibrate|adjust|audit|reconcile|file|route|assign|brief|train|mentor|answer|walk through|onboard)\b/i;

export function isObservableVerb(value: string): boolean {
  return OBSERVABLE.test(value);
}

export const WIZARD_STEPS: {
  id: WizardStepId;
  title: string;
  prompt: string;
  hint: string;
  placeholder: string;
  input: "text" | "textarea" | "number" | "delivery";
}[] = [
  {
    id: "title",
    title: "Course name",
    prompt: "What should we call this course?",
    hint: "A working title learners and stakeholders will recognize — usually the job outcome, not a vague topic.",
    placeholder: "Writing a blameless post-incident review",
    input: "text",
  },
  {
    id: "audience",
    title: "Audience",
    prompt: "Who is taking this course?",
    hint: "Role, experience level, and context. “Employees” is too broad.",
    placeholder: "Engineering leads and incident commanders with 1+ year on-call",
    input: "text",
  },
  {
    id: "jobTask",
    title: "Job task",
    prompt: "What must they be able to do after the course?",
    hint: "Something you could actually watch them do — not a list of topics.",
    placeholder: "Write a facts-only PIR from a Sev-2 timeline and chat export",
    input: "textarea",
  },
  {
    id: "whyNow",
    title: "Why now",
    prompt: "Why does this matter right now?",
    hint: "What it costs if people keep doing it the old way.",
    placeholder: "Blame language in PIRs is killing incident reporting",
    input: "textarea",
  },
  {
    id: "durationMinutes",
    title: "Length",
    prompt: "How long should this take the learner?",
    hint: "The learner's time, not the time it takes you to build it. Everything else gets sized around this.",
    placeholder: "25",
    input: "number",
  },
  {
    id: "constraints",
    title: "Constraints",
    prompt: "What limits shape the design?",
    hint: "Async only, no workshop, compliance, tools available, language, accessibility, etc. “None” is fine if true.",
    placeholder: "Async only, no live workshop, must work on mobile",
    input: "textarea",
  },
  {
    id: "delivery",
    title: "Delivery",
    prompt: "Where will people actually take this?",
    hint: "Pick one or more. Lessons will be assigned to the best fit later.",
    placeholder: "",
    input: "delivery",
  },
];

export function emptyBriefDraft(): BriefDraft {
  return {
    title: "",
    audience: "",
    jobTask: "",
    whyNow: "",
    durationMinutes: 25,
    constraints: "",
    delivery: [...DELIVERY_TARGETS],
  };
}

export function evaluateWizardField(
  step: WizardStepId,
  draft: BriefDraft,
): FieldEvaluation {
  switch (step) {
    case "title":
      return evaluateTitle(draft.title);
    case "audience":
      return evaluateAudience(draft.audience);
    case "jobTask":
      return evaluateJobTask(draft.jobTask);
    case "whyNow":
      return evaluateWhyNow(draft.whyNow);
    case "durationMinutes":
      return evaluateDuration(draft.durationMinutes);
    case "constraints":
      return evaluateConstraints(draft.constraints);
    case "delivery":
      return evaluateDelivery(draft.delivery);
  }
}

function base(): FieldEvaluation {
  return {
    ok: false,
    score: 0,
    summary: "",
    issues: [],
    clarifyingQuestions: [],
    rewriteHints: [],
  };
}

function finalize(
  result: FieldEvaluation,
  passSummary: string,
): FieldEvaluation {
  if (result.issues.length === 0) {
    return {
      ...result,
      ok: true,
      score: Math.max(result.score, 80),
      summary: passSummary,
    };
  }
  return {
    ...result,
    ok: false,
    score: Math.min(result.score || 40, 65),
    summary:
      result.summary ||
      "Needs a bit more clarity — answer the questions below, then try again.",
  };
}

function evaluateTitle(raw: string): FieldEvaluation {
  const value = raw.trim();
  const result = base();
  result.score = 50;
  if (value.length < 8) {
    result.issues.push("Title is too short to be useful.");
    result.clarifyingQuestions.push(
      "What job outcome or skill should the title name?",
    );
  }
  if (value.length > 90) {
    result.issues.push("Title is too long for a course name.");
    result.rewriteHints.push("Keep it under ~12 words.");
  }
  if (/^(new course|course|training|module)\b/i.test(value)) {
    result.issues.push("Title is generic.");
    result.clarifyingQuestions.push(
      "What specific performance will learners leave able to do?",
    );
  }
  if (TOPIC_ONLY.test(value) && !OBSERVABLE.test(value)) {
    result.issues.push("This sounds like a class about a topic, not something they'll walk away able to do.");
    result.rewriteHints.push(
      "Lead with an action, e.g. “Writing a blameless PIR” instead of “PIR awareness.”",
    );
  }
  return finalize(result, "Title is specific enough to carry the brief.");
}

function evaluateAudience(raw: string): FieldEvaluation {
  const value = raw.trim();
  const result = base();
  result.score = 50;
  if (value.length < 12) {
    result.issues.push("Audience is too vague.");
    result.clarifyingQuestions.push(
      "What role(s) take this, and roughly what experience level?",
    );
  }
  if (/^(everyone|all staff|employees|users|people|team)\b/i.test(value)) {
    result.issues.push("That's too broad to build real practice around.");
    result.clarifyingQuestions.push(
      "Who's the main group taking this? Anyone secondary?",
    );
    result.rewriteHints.push(
      "Name a role + context, e.g. “new store managers in their first 90 days.”",
    );
  }
  if (!/\b(lead|manager|engineer|nurse|agent|analyst|coordinator|specialist|instructor|rep|operator|commander|director|associate|intern|new hire)\b/i.test(
    value,
  ) && value.split(/\s+/).length < 4) {
    result.issues.push("We couldn't tell what job or role this is for.");
    result.clarifyingQuestions.push("What job title or function is this for?");
  }
  return finalize(result, "Audience is specific enough to design for.");
}

function evaluateJobTask(raw: string): FieldEvaluation {
  const value = raw.trim();
  const result = base();
  result.score = 45;
  if (value.length < 16) {
    result.issues.push("Job task is too short.");
    result.clarifyingQuestions.push(
      "In one sentence: what can they do on the job that they cannot do today?",
    );
  }
  if (HOLLOW.test(value)) {
    result.issues.push("That describes knowing something, not doing something.");
    result.clarifyingQuestions.push(
      "What would you watch them do to prove they “understand”?",
    );
    result.rewriteHints.push(
      "Swap in something you could watch them do: write, configure, critique, select, draft…",
    );
  }
  if (TOPIC_ONLY.test(value) && !OBSERVABLE.test(value)) {
    result.issues.push("That sounds like a topic you'd cover, not something they'd actually do.");
    result.clarifyingQuestions.push(
      "If you shadowed them next week, what work product or action would prove success?",
    );
  }
  if (!OBSERVABLE.test(value)) {
    result.issues.push("There's no clear action here — something you could watch them do.");
    result.clarifyingQuestions.push(
      "Start with something you could watch and check — not something only they'd know they did.",
    );
  }
  if (!/\b(from|using|given|with|after|during|when)\b/i.test(value) && value.length > 20) {
    result.clarifyingQuestions.push(
      "What tools, inputs, or situation will they have when they do this?",
    );
    result.rewriteHints.push(
      "Add the setup: “Given [the situation], do [the task], well enough to [the standard].”",
    );
    // Soft issue — only fail if already weak
    if (result.issues.length > 0) {
      result.issues.push("Missing the setup — what tools or situation they'll have.");
    } else {
      result.score = 72;
      result.rewriteHints.push(
        "Optional: add the setup and the standard to sharpen it further.",
      );
    }
  }
  // If only soft hint, still pass
  if (
    result.issues.length === 0 &&
    OBSERVABLE.test(value) &&
    !HOLLOW.test(value)
  ) {
    return finalize(result, "This is something you can watch and build practice around.");
  }
  if (
    result.issues.length === 1 &&
    result.issues[0].includes("Missing condition") &&
    OBSERVABLE.test(value)
  ) {
    result.issues = [];
    return finalize(
      result,
      "This works. Adding the setup later will make the practice sharper.",
    );
  }
  return finalize(result, "This is something you can watch and build practice around.");
}

function evaluateWhyNow(raw: string): FieldEvaluation {
  const value = raw.trim();
  const result = base();
  result.score = 50;
  if (value.length < 12) {
    result.issues.push("Why-now is empty or too thin.");
    result.clarifyingQuestions.push(
      "What goes wrong at work if people keep doing the old thing?",
    );
  }
  if (/^(because|required|compliance|mandatory|leadership asked)\b/i.test(value) && value.length < 40) {
    result.issues.push("That sounds like a rule from above — what actually breaks if we skip it?");
    result.clarifyingQuestions.push(
      "What broken result, risk, cost, or delay does this course prevent?",
    );
  }
  if (!/\b(because|risk|cost|error|delay|fail|hurt|kill|lose|miss|complaint|incident|safety|quality|revenue|trust|reporting)\b/i.test(
    value,
  ) && value.length >= 12) {
    result.clarifyingQuestions.push(
      "Can you name the concrete cost or risk in one phrase?",
    );
    result.rewriteHints.push(
      "Example: “Blame in PIRs is suppressing incident reports.”",
    );
    if (value.length < 30) {
      result.issues.push("We need a clearer picture of what goes wrong without this.");
    }
  }
  return finalize(result, "This gives people a real reason to care.");
}

function evaluateDuration(minutes: number): FieldEvaluation {
  const result = base();
  result.score = 50;
  if (!Number.isFinite(minutes) || minutes <= 0) {
    result.issues.push("Seat time must be a positive number of minutes.");
    result.clarifyingQuestions.push("How long should a typical learner spend?");
  } else if (minutes < 10) {
    result.issues.push("Under 10 minutes usually isn't enough time to practice and show they've got it.");
    result.clarifyingQuestions.push(
      "Is this a micro tip, or a real course with practice?",
    );
  } else if (minutes > 120) {
    result.issues.push("Over 120 minutes usually works better split into a few shorter courses.");
    result.clarifyingQuestions.push(
      "What's the one thing they must be able to do in this sitting? Save the rest for another course.",
    );
    result.rewriteHints.push("Aim for 15–45 minutes for a focused async course.");
  }
  return finalize(
    result,
    `${minutes} minutes is a reasonable amount of time to plan around.`,
  );
}

function evaluateConstraints(raw: string): FieldEvaluation {
  const value = raw.trim();
  const result = base();
  result.score = 70;
  if (!value) {
    result.issues.push("Type “none” if there really aren't any — leaving it blank is unclear.");
    result.clarifyingQuestions.push(
      "Any limits on modality, tools, compliance, language, or devices?",
    );
  } else if (/^(n\/?a|na|-)\s*$/i.test(value)) {
    result.rewriteHints.push("Type “None” so we know you checked, not just skipped it.");
    // still pass
  }
  return finalize(
    result,
    value.toLowerCase() === "none" || /^none\b/i.test(value)
      ? "No limits on this one."
      : "These limits will shape how the course gets built.",
  );
}

function evaluateDelivery(delivery: DeliveryTarget[]): FieldEvaluation {
  const result = base();
  result.score = 50;
  if (!delivery.length) {
    result.issues.push("Pick at least one delivery channel.");
    result.clarifyingQuestions.push(
      "Where will learners actually encounter this — Rise, Canvas, Doc, video, tutor?",
    );
  }
  return finalize(
    result,
    `Set to: ${delivery.join(", ")}.`,
  );
}

export function evaluateBrief(draft: BriefDraft): Record<WizardStepId, FieldEvaluation> {
  return {
    title: evaluateWizardField("title", draft),
    audience: evaluateWizardField("audience", draft),
    jobTask: evaluateWizardField("jobTask", draft),
    whyNow: evaluateWizardField("whyNow", draft),
    durationMinutes: evaluateWizardField("durationMinutes", draft),
    constraints: evaluateWizardField("constraints", draft),
    delivery: evaluateWizardField("delivery", draft),
  };
}

export function briefReady(draft: BriefDraft): boolean {
  const all = evaluateBrief(draft);
  return Object.values(all).every((item) => item.ok);
}
