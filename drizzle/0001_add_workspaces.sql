CREATE TABLE "workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "workspace_id" uuid;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "role" text DEFAULT 'owner' NOT NULL;
--> statement-breakpoint
-- Backfill: every existing user gets their own fresh workspace so nobody's
-- data merges with anybody else's just from running this migration. Future
-- teammates join via invitations, handled entirely at the application layer.
DO $$
DECLARE
  existing_user RECORD;
  new_workspace_id uuid;
BEGIN
  FOR existing_user IN SELECT id, email FROM "users" WHERE "workspace_id" IS NULL LOOP
    INSERT INTO "workspaces" ("name") VALUES (existing_user.email || '''s workspace')
      RETURNING id INTO new_workspace_id;
    UPDATE "users" SET "workspace_id" = new_workspace_id WHERE id = existing_user.id;
  END LOOP;
END $$;
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "workspace_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "users_workspace_id_idx" ON "users" USING btree ("workspace_id");
--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"email" text NOT NULL,
	"token" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"invited_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"accepted_at" timestamp with time zone,
	CONSTRAINT "invitations_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "invitations_workspace_id_idx" ON "invitations" USING btree ("workspace_id");
--> statement-breakpoint
CREATE INDEX "invitations_email_idx" ON "invitations" USING btree ("email");
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "workspace_id" uuid;
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "created_by_user_id" uuid;
--> statement-breakpoint
UPDATE "projects" SET
  "workspace_id" = "users"."workspace_id",
  "created_by_user_id" = "projects"."owner_id"
FROM "users"
WHERE "users"."id" = "projects"."owner_id";
--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "workspace_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "projects_workspace_id_idx" ON "projects" USING btree ("workspace_id");
--> statement-breakpoint
DROP INDEX "projects_owner_id_idx";
--> statement-breakpoint
ALTER TABLE "projects" DROP CONSTRAINT "projects_owner_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "owner_id";
