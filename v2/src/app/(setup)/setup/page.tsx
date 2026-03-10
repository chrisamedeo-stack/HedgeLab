import { redirect } from "next/navigation";
import { queryOne } from "@/lib/db";
import { SetupWizard } from "@/components/setup/SetupWizard";

export default async function SetupPage() {
  // If an org already exists, redirect to dashboard
  const org = await queryOne<{ id: string }>(
    `SELECT id FROM organizations WHERE is_active = true LIMIT 1`
  );

  if (org) {
    redirect("/dashboard");
  }

  return (
    <div>
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-primary">Welcome to HedgeLab</h1>
        <p className="mt-2 text-sm text-muted">
          Let&apos;s set up your organization in a few quick steps.
        </p>
      </div>
      <SetupWizard />
    </div>
  );
}
