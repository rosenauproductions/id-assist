-- SME interviews: an ID either fills this in live on a call, or generates a
-- shareable link the SME answers on their own. Both modes write into the
-- same answers blob and synthesize down into a normal CourseBrief when the
-- ID is ready to create a project from it.
CREATE TABLE "interview_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"created_by_user_id" uuid,
	"token" text NOT NULL,
	"sme_name" text,
	"course_working_title" text,
	"answers" jsonb,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"project_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "interview_sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "interview_sessions" ADD CONSTRAINT "interview_sessions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "interview_sessions" ADD CONSTRAINT "interview_sessions_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "interview_sessions" ADD CONSTRAINT "interview_sessions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "interview_sessions_workspace_id_idx" ON "interview_sessions" USING btree ("workspace_id");
