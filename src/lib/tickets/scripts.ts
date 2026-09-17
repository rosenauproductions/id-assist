export type TicketType = "bug" | "suggestion";

export type TicketQuestion = {
  id: string;
  prompt: string;
  hint: string;
  placeholder: string;
  optional?: boolean;
};

// The two "bot" scripts — a fixed, ordered question set per ticket type,
// walked one at a time by the same UI (src/components/ticket-bot.tsx),
// same underlying mechanic the SME interview uses (a script drives a
// sequential Q&A that gets synthesized into a structured record at the
// end), just without that feature's AI coaching layer — a bug/feature
// report doesn't need Bloom-level scrutiny, only enough structure that
// Chris isn't reading a bare, unstructured text box.
export const TICKET_SCRIPTS: Record<TicketType, TicketQuestion[]> = {
  bug: [
    {
      id: "whatHappened",
      prompt: "What happened?",
      hint: "Describe what went wrong, in your own words.",
      placeholder: "The outline wouldn't save after I edited an objective...",
    },
    {
      id: "expected",
      prompt: "What did you expect to happen instead?",
      hint: "What should have happened, if it had worked?",
      placeholder: "I expected my edit to save and the filters to re-run.",
    },
    {
      id: "steps",
      prompt: "What were you doing right before it happened?",
      hint: "The steps that lead up to it — even a rough sequence helps.",
      placeholder: "1. Opened the project. 2. Edited the Bloom level. 3. Clicked save.",
    },
    {
      id: "where",
      prompt: "Where in the app was this?",
      hint: "A page, project, or feature name — whatever you remember.",
      placeholder: "The Outcomes tab on a project workspace.",
      optional: true,
    },
  ],
  suggestion: [
    {
      id: "problem",
      prompt: "What problem would this solve?",
      hint: "What's frustrating, slow, or missing today?",
      placeholder: "I have to re-type the same constraints for every course.",
    },
    {
      id: "usage",
      prompt: "How would you actually use it?",
      hint: "Walk through it like you're describing it to a teammate.",
      placeholder: "I'd save a few constraint presets and pick one per course.",
    },
    {
      id: "workaround",
      prompt: "How do you handle this today, if at all?",
      hint: "Any workaround, even a clunky one, helps show the real cost.",
      placeholder: "I keep a doc of standard constraints and copy-paste.",
      optional: true,
    },
  ],
};

export const TICKET_TYPE_LABELS: Record<TicketType, string> = {
  bug: "Report an issue",
  suggestion: "Suggest a feature",
};

export function isTicketType(value: unknown): value is TicketType {
  return value === "bug" || value === "suggestion";
}

/** Turns raw question/answer pairs into the ticket's readable summary —
 * simple templating rather than an AI call, since a feedback ticket
 * doesn't need synthesis beyond "put the answers in order with their
 * questions," unlike the SME interview's CourseBrief fields. */
export function synthesizeSummary(
  type: TicketType,
  answers: Record<string, string>,
): string {
  const script = TICKET_SCRIPTS[type];
  return script
    .map((question) => {
      const answer = (answers[question.id] ?? "").trim();
      if (!answer) return null;
      return `${question.prompt}\n${answer}`;
    })
    .filter((entry): entry is string => Boolean(entry))
    .join("\n\n");
}
