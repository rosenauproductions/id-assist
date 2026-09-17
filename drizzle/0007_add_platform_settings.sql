CREATE TABLE "site_settings" (
	"id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
	"hero_eyebrow" text,
	"hero_headline" text,
	"hero_subhead" text,
	"hero_cta_label" text,
	"accent_color" text,
	"feature_cards" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_settings" (
	"id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
	"trial_days" integer,
	"monthly_generation_limit" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
