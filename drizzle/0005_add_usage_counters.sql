-- Monthly AI-generation usage counter per workspace: a cost-protection
-- guardrail so a paying account can't run unlimited Gemini generations
-- against Chris's own API key. Reset when period_start rolls into a new
-- calendar month (checked in application code, not a cron job).
CREATE TABLE "usage_counters" (
	"workspace_id" uuid PRIMARY KEY NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"generation_count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "usage_counters" ADD CONSTRAINT "usage_counters_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
