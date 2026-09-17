import Link from "next/link";
import { requireWorkspaceContext } from "@/lib/team/store";
import { getAppearance, getWorkspaceSettings } from "@/lib/settings/store";
import { getAvailablePlanOptions, getBillingSummary } from "@/lib/billing/store";
import { DELIVERY_TARGETS } from "@/lib/id/types";
import { SettingsPanel } from "./settings-panel";

export default async function SettingsPage() {
  const context = await requireWorkspaceContext();
  const [appearance, workspaceSettings, billing, planOptions] = await Promise.all([
    getAppearance(),
    getWorkspaceSettings(),
    getBillingSummary(context.workspaceId),
    getAvailablePlanOptions(),
  ]);

  const workspace = workspaceSettings ?? {
    name: context.workspaceName,
    defaultDelivery: [...DELIVERY_TARGETS],
    modelOverride: null,
  };

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/app" className="text-sm text-muted hover:text-foreground">
        ← Home
      </Link>
      <p className="mt-3 text-xs font-medium uppercase tracking-[0.14em] text-accent">
        {context.workspaceName}
      </p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">Settings</h1>
      <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
        Appearance is personal and saved to your account. Workspace settings
        are shared with everyone here and can only be changed by an owner.
      </p>
      <SettingsPanel
        appearance={appearance}
        isOwner={context.role === "owner"}
        workspace={workspace}
        billing={billing}
        planOptions={planOptions}
      />
    </main>
  );
}
