import { COURSE_PHASES, type IdProject } from "./types";

/**
 * Versioned migrations for the `IdProject` JSON blob stored in
 * `projects.data`. This exists because that object's shape has already
 * grown twice (requirements[], phaseProgress[]) since the app shipped,
 * each time patched in ad hoc with an "if it's missing, default it" line
 * wherever a project got loaded — fragile, because nothing recorded which
 * projects still needed which patch, and every patch ran on every load
 * forever whether it was needed or not.
 *
 * Instead: every IdProject carries a `schemaVersion`. Each migration below
 * brings a project from one version to the next. `migrateProject()` walks
 * a loaded project through every migration above its stored version, in
 * order, and stamps it at CURRENT_SCHEMA_VERSION. New projects are created
 * at CURRENT_SCHEMA_VERSION directly (see compile.ts / import-outline.ts)
 * and never touch this file.
 *
 * Rules for adding a migration:
 * 1. Never edit or remove a migration once it has shipped — a project
 *    sitting at an old version depends on every step between its version
 *    and the current one still existing and behaving the same way.
 * 2. To change today's default shape, add a NEW migration at the end of
 *    the array with the next version number, even if it feels like it's
 *    "redoing" an earlier one.
 * 3. A migration only needs to be additive/corrective (fill in a missing
 *    or differently-shaped field) — it never needs to validate the whole
 *    object, only the one thing it's responsible for fixing.
 * 4. Keep each migration's `up()` defensive: check before writing, so
 *    re-running it on an already-migrated shape (which won't normally
 *    happen, but costs nothing to guard against) is a no-op.
 */

type Migration = {
  /** The schemaVersion a project has *after* this migration runs. */
  version: number;
  description: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  up: (project: any) => void;
};

const MIGRATIONS: Migration[] = [
  {
    version: 1,
    description: "Add requirements[] (Required/Recommended/Optional checklist).",
    up: (project) => {
      if (!project.requirements) {
        project.requirements = [];
      }
    },
  },
  {
    version: 2,
    description: "Add phaseProgress[] (8-phase Discovery→Publishing timeline).",
    up: (project) => {
      if (!project.phaseProgress) {
        project.phaseProgress = COURSE_PHASES.map((phase) => ({ phase }));
      }
    },
  },
  {
    version: 3,
    description:
      "Convert Lesson.objectiveId (singular) to Lesson.objectiveIds[] (a lesson can serve multiple objectives).",
    up: (project) => {
      const lessons = project.outline?.lessons;
      if (!Array.isArray(lessons)) return;
      for (const lesson of lessons) {
        if (!Array.isArray(lesson.objectiveIds)) {
          lesson.objectiveIds = lesson.objectiveId ? [lesson.objectiveId] : [];
        }
        delete lesson.objectiveId;
      }
    },
  },
];

export const CURRENT_SCHEMA_VERSION =
  MIGRATIONS.length > 0 ? MIGRATIONS[MIGRATIONS.length - 1].version : 0;

/**
 * Brings a raw loaded object (whatever shape it happens to be — an old
 * project may predate several fields) up to CURRENT_SCHEMA_VERSION. Called
 * once, at the read choke point in store.ts, so every other line of app
 * code can trust `IdProject` matches its current type without re-checking.
 *
 * This mutates and returns the same object; it does not write anything
 * back to the database itself — the migrated shape gets persisted the
 * next time the project is actually saved (matching how the old ad hoc
 * defaulting behaved), so a project a read-only/suspended workspace can
 * still view still renders correctly without needing write access.
 */
export function migrateProject(raw: unknown): IdProject {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const project = raw as any;
  let version: number = typeof project.schemaVersion === "number" ? project.schemaVersion : 0;

  for (const migration of MIGRATIONS) {
    if (migration.version > version) {
      migration.up(project);
      version = migration.version;
    }
  }

  project.schemaVersion = CURRENT_SCHEMA_VERSION;
  return project as IdProject;
}
