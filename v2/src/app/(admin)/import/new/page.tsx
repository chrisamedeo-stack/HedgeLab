"use client";

import { useEffect } from "react";
import { ImportWizard } from "@/components/import/ImportWizard";
import { useImportStore } from "@/store/importStore";

export default function ImportNewPage() {
  const { reset } = useImportStore();

  // Reset wizard state when navigating to this page
  useEffect(() => {
    reset();
  }, [reset]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-zinc-100">New Import</h1>
        <p className="mt-0.5 text-sm text-zinc-500">
          Import data from CSV files with AI-assisted column mapping.
        </p>
      </div>
      <div className="rounded-xl border border-zinc-700/50 bg-zinc-900/30 p-6">
        <ImportWizard orgId="00000000-0000-0000-0000-000000000001" />
      </div>
    </div>
  );
}
