import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * A shared workspace — everyone invited into it sees/edits all of its
 * projects (the "one shared workspace" model, not per-project assignment).
 */
export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  // Default delivery-channel mix (DeliveryTarget[]) pre-checked on new
  // briefs. Null means "no override" — falls back to every channel checked.
  defaultDelivery: jsonb("default_delivery"),
  // Owner-set Gemini model name (e.g. "gemini-2.5-pro") that overrides
  // GOOGLE_MODEL for this workspace. Null means "use the deploy default."
  modelOverride: text("model_override"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    // "owner" can invite/remove teammates and change roles; "member" can
    // create and edit projects like anyone else in the workspace.
    role: text("role").notNull().default("member"),
    // Personal appearance preference, saved to the account so it follows
    // you across devices. "system" means "match the OS preference."
    themeMode: text("theme_mode").notNull().default("system"),
    accentTheme: text("accent_theme").notNull().default("teal"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("users_workspace_id_idx").on(table.workspaceId)],
);

/** Pending (or accepted, kept for history) invites to join a workspace. */
export const invitations = pgTable(
  "invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    // Opaque, unguessable — the invite link is /signup?invite=<token>.
    token: text("token").notNull().unique(),
    role: text("role").notNull().default("member"),
    invitedByUserId: uuid("invited_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  },
  (table) => [
    index("invitations_workspace_id_idx").on(table.workspaceId),
    index("invitations_email_idx").on(table.email),
  ],
);

export const projects = pgTable(
  "projects",
  {
    // Same prj_xxxxxxxx id compile.ts already generates via nid("prj").
    id: text("id").primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    // Who originally created it — attribution only. Nullable + set null on
    // delete so removing a teammate later never blocks on their projects;
    // the project stays visible to the rest of the workspace either way.
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    // Denormalized from outline.brief.title / outline.status for listing —
    // the source of truth is still the `data` blob below.
    title: text("title").notNull(),
    status: text("status").notNull(),
    // The whole IdProject object (outline, team, estimate, timeLogs, and
    // artifacts with their markdown bodies inlined) — same shape the app
    // has always worked with, just a row instead of project.json on disk.
    data: jsonb("data").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("projects_workspace_id_idx").on(table.workspaceId)],
);

export const interviewSessions = pgTable(
  "interview_sessions",
  {
    // Same nid("intv") id shape projects use nid("prj").
    id: text("id").primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    // Opaque, unguessable — the SME's share link is /interview/link/<token>.
    token: text("token").notNull().unique(),
    smeName: text("sme_name"),
    courseWorkingTitle: text("course_working_title"),
    // Record<WizardStepId, Record<questionId, string>> — raw per-question
    // answers from either the live interview or the SME's own link. Null
    // means "no answers yet" (same nullable-jsonb pattern as
    // workspaces.defaultDelivery); the store layer defaults it to {}.
    answers: jsonb("answers"),
    // "in_progress" (still being answered) | "submitted" (SME or the ID
    // marked it ready for review) | "completed" (a project was created).
    status: text("status").notNull().default("in_progress"),
    projectId: text("project_id").references(() => projects.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("interview_sessions_workspace_id_idx").on(table.workspaceId),
  ],
);
