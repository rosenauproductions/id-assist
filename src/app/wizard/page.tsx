import Link from "next/link";
import { BriefWizard } from "./brief-wizard";

export default function WizardPage() {
  return (
    <main>
      <div className="mx-auto max-w-2xl px-6 pt-6">
        <Link href="/" className="text-sm text-muted hover:text-foreground">
          ← Full brief form
        </Link>
      </div>
      <BriefWizard />
    </main>
  );
}
