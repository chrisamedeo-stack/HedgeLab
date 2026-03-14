"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SetupWizard } from "@/components/setup/SetupWizard";
import { API_BASE } from "@/lib/api";

export default function SetupPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Check if an org already exists — redirect to dashboard if so
    fetch(`${API_BASE}/api/kernel/organizations`)
      .then((r) => (r.ok ? r.json() : []))
      .then((orgs) => {
        if (Array.isArray(orgs) && orgs.length > 0) {
          router.replace("/dashboard");
        } else {
          setReady(true);
        }
      })
      .catch(() => setReady(true)); // DB not ready yet — show wizard
  }, [router]);

  if (!ready) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-sm text-muted">Checking setup status...</div>
      </div>
    );
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
