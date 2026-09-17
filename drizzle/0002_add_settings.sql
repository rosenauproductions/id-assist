-- Personal appearance (per-user, follows the account across devices).
ALTER TABLE "users" ADD COLUMN "theme_mode" text NOT NULL DEFAULT 'system';
ALTER TABLE "users" ADD COLUMN "accent_theme" text NOT NULL DEFAULT 'teal';

-- Workspace-level settings (owner-editable, shared by everyone in it).
ALTER TABLE "workspaces" ADD COLUMN "default_delivery" jsonb;
ALTER TABLE "workspaces" ADD COLUMN "model_override" text;
