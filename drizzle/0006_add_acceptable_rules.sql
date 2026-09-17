-- Workspace-wide "always allow this issue" mute list for pedagogy filters:
-- one row per (workspace, filter code) the workspace has chosen to stop
-- seeing. Applied in saveProject(), which marks any matching FilterHit as
-- resolved before persisting; runFilters() itself is unchanged.
CREATE TABLE "acceptable_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"filter_code" text NOT NULL,
	"added_by_user_id" uuid,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "acceptable_rules" ADD CONSTRAINT "acceptable_rules_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "acceptable_rules" ADD CONSTRAINT "acceptable_rules_added_by_user_id_users_id_fk" FOREIGN KEY ("added_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "acceptable_rules_workspace_code_idx" ON "acceptable_rules" USING btree ("workspace_id","filter_code");
