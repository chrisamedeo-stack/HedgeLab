"use client";

import { useEffect } from "react";
import { ImportWizard } from "@/components/import/ImportWizard";
import { useImportStore } from "@/store/importStore";
import { useAuth } from "@/contexts/AuthContext";

export default function ImportNewPage() {
  const { reset } = useImportStore();
  const { user } = useAuth();

  // Reset wizard state when navigating to this page
  useEffect(() => {
    reset();
  }, [reset]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-primary">New Import</h1>
        <p className="mt-0.5 text-sm text-muted">
          Import data from CSV files with AI-assisted column mapping.
        </p>
      </div>
      <div className="rounded-xl border border-b-default bg-surface p-6">
        <ImportWizard orgId={user?.orgId ?? ""} />
      </div>
    </div>
  );
}
