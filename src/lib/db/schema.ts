import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * A shared workspace — everyone invited into it sees/edits all of its
 * projects (the "one shared workspace" model, not per-project assignment).
 */
export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
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
