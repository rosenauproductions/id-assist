import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const projects = pgTable(
  "projects",
  {
    // Same prj_xxxxxxxx id compile.ts already generates via nid("prj").
    id: text("id").primaryKey(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
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
  (table) => [index("projects_owner_id_idx").on(table.ownerId)],
);
