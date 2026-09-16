import type {
  Bloom,
  DeliveryTarget,
  IdProject,
  Lesson,
  ProductionEstimate,
  Resource,
} from "./types";

const BLOOM_WEIGHT: Record<Bloom, number> = {
  remember: 0.7,
  understand: 0.85,
  apply: 1,
  analyze: 1.25,
  evaluate: 1.4,
  create: 1.55,
};

const DELIVERY_HOURS: Record<DeliveryTarget, number> = {
  rise: 2.4,
  canvas: 1.2,
  gdoc: 1.1,
  gslides: 1.4,
  video: 3.6,
  tutor: 2.8,
};

function lessonBloom(project: IdProject, lesson: Lesson): Bloom {
  return (
    project.outline.outcomes.find((outcome) => outcome.id === lesson.objectiveId)
      ?.bloom ?? "understand"
  );
}

function priorLessonHours(project: IdProject, lesson: Lesson): number {
  const bloom = lessonBloom(project, lesson);
  let hours = DELIVERY_HOURS[lesson.delivery] * BLOOM_WEIGHT[bloom];
  for (const extra of lesson.supplements) {
    hours += DELIVERY_HOURS[extra] * 0.35 * BLOOM_WEIGHT[bloom];
  }
  return hours;
}

function humanHours(team: Resource[]): number {
  return team
    .filter((resource) => resource.kind === "human")
    .reduce((sum, resource) => sum + resource.hoursPerWeek, 0);
}

function bottleneck(team: Resource[]): { label: string; hoursPerWeek: number } {
  const humans = team.filter((resource) => resource.kind === "human");
  const sme = humans.find((resource) => resource.roles.includes("SME"));
  if (sme && sme.hoursPerWeek <= 5) {
    return {
      label: `${sme.name} (SME, ${sme.hoursPerWeek} h/wk)`,
      hoursPerWeek: sme.hoursPerWeek,
    };
  }
  const slowest = [...humans].sort((a, b) => a.hoursPerWeek - b.hoursPerWeek)[0];
  if (!slowest) {
    return { label: "No humans assigned", hoursPerWeek: 0 };
  }
  return {
    label: `${slowest.name} (${slowest.hoursPerWeek} h/wk)`,
    hoursPerWeek: slowest.hoursPerWeek,
  };
}

function velocityFactor(project: IdProject): {
  factor: number;
  basis: ProductionEstimate["basis"];
  note?: string;
} {
  const logs = project.timeLogs ?? [];
  const actualHours = logs.reduce((sum, log) => sum + log.hours, 0);
  if (actualHours <= 0) {
    return { factor: 1, basis: "outline" };
  }

  const loggedLessonIds = new Set(
    logs.map((log) => log.lessonId).filter(Boolean) as string[],
  );
  let priorForLogged = 0;
  if (loggedLessonIds.size > 0) {
    for (const lesson of project.outline.lessons) {
      if (loggedLessonIds.has(lesson.id)) {
        priorForLogged += priorLessonHours(project, lesson);
      }
    }
  }

  // If logs are phase-only (no lesson), compare against a slice of the outline prior.
  if (priorForLogged <= 0) {
    const outlinePrior =
      2.5 +
      project.outline.lessons.reduce(
        (sum, lesson) => sum + priorLessonHours(project, lesson),
        0,
      );
    priorForLogged = Math.max(outlinePrior * 0.25, actualHours * 0.6);
  }

  const factor = Math.min(2.5, Math.max(0.5, actualHours / priorForLogged));
  return {
    factor,
    basis: "velocity",
    note: `Velocity from ${actualHours.toFixed(1)} logged h vs ${priorForLogged.toFixed(1)} prior h (×${factor.toFixed(2)}).`,
  };
}

export function estimateProject(project: IdProject): ProductionEstimate {
  const { outline, team } = project;
  const notes: string[] = [];
  const velocity = velocityFactor(project);

  let priorHours = 2.5;
  for (const lesson of outline.lessons) {
    priorHours += priorLessonHours(project, lesson);
  }

  const actualHours = (project.timeLogs ?? []).reduce(
    (sum, log) => sum + log.hours,
    0,
  );
  const remainingPrior = Math.max(priorHours - actualHours / velocity.factor, 0);
  const p50Hours = actualHours + remainingPrior * velocity.factor;

  const openRisk = outline.filters.filter(
    (filter) =>
      !filter.resolved &&
      (filter.severity === "rewrite" ||
        filter.severity === "split" ||
        filter.severity === "block"),
  ).length;
  const p90Hours = p50Hours * (1.25 + openRisk * 0.08);

  const idAssistRuns = 1 + openRisk;
  const aiCost = team
    .filter((resource) => resource.kind === "ai")
    .reduce(
      (sum, resource) => sum + resource.costPerRunUsd * Math.max(idAssistRuns, 1),
      0,
    );

  let labor = 0;
  let smeFee = 0;
  for (const resource of team) {
    if (resource.kind !== "human") continue;
    const share = Math.min(p50Hours, resource.hoursPerWeek * 2);
    if (resource.sme?.kind === "w2") {
      notes.push(
        `${resource.name} is W2: $0 invoice. Calendar still uses ${resource.hoursPerWeek} h/wk around other duties.`,
      );
      if (resource.sme.loadedRateUsd) {
        labor += share * resource.sme.loadedRateUsd;
      }
    } else if (resource.sme?.kind === "per_project") {
      smeFee += resource.sme.feeUsd;
      notes.push(
        `${resource.name} is per-project at $${resource.sme.feeUsd.toLocaleString()} (no ceiling; typical hint $1k–$5k).`,
      );
    } else if (resource.hourlyRateUsd) {
      labor += share * resource.hourlyRateUsd;
    }
  }

  const neck = bottleneck(team);
  const remainingHours = Math.max(p50Hours - actualHours, 0);
  const calendarDays =
    neck.hoursPerWeek <= 0
      ? 21
      : Math.ceil((remainingHours / Math.max(neck.hoursPerWeek, 0.5)) * 5);

  if (humanHours(team) === 0) {
    notes.push("Unknown team: using a default ID persona until you add people.");
  }
  if (velocity.note) notes.unshift(velocity.note);
  if (actualHours > 0) {
    notes.push(`${actualHours.toFixed(1)} h logged so far.`);
  }

  const p50CostUsd = labor + smeFee + aiCost;
  const p90CostUsd = p50CostUsd * 1.2 + openRisk * 120;

  return {
    asOf: new Date().toISOString(),
    basis: velocity.basis,
    learnerMinutes: outline.brief.durationMinutes,
    p50Hours: round1(p50Hours),
    p90Hours: round1(p90Hours),
    calendarDays,
    bottleneck: neck.label,
    p50CostUsd: Math.round(p50CostUsd),
    p90CostUsd: Math.round(p90CostUsd),
    buckets: [
      { label: "Labor", amountUsd: Math.round(labor), note: "Non-SME hourly" },
      {
        label: "SME fee",
        amountUsd: Math.round(smeFee),
        note: "W2 is $0 invoice",
      },
      {
        label: "ID Assist / AI",
        amountUsd: Math.round(aiCost),
        note: `${Math.max(idAssistRuns, 1)} compiler runs`,
      },
    ],
    notes,
  };
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function defaultTeam(): Resource[] {
  return [
    {
      id: "res_id",
      kind: "human",
      name: "You",
      roles: ["ID"],
      skills: ["instructional-design", "writing"],
      hoursPerWeek: 15,
      hourlyRateUsd: 85,
    },
    {
      id: "res_sme",
      kind: "human",
      name: "SME",
      roles: ["SME"],
      skills: ["domain", "approval"],
      hoursPerWeek: 3,
      sme: { kind: "w2" },
    },
    {
      id: "res_assist",
      kind: "ai",
      name: "ID Assist",
      skills: ["outline", "filters", "draft", "tutor"],
      costPerRunUsd: 4,
    },
  ];
}
