"use client";

import { useRouter } from "next/navigation";
import { useSetupStore } from "@/store/setupStore";

export function CompletionView() {
  const router = useRouter();
  const { orgName } = useSetupStore();

  return (
    <div className="flex flex-col items-center py-12">
      <div className="mb-4 rounded-full bg-profit-10 p-4 text-profit">
        <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h3 className="text-xl font-semibold text-secondary">Organization Created</h3>
      <p className="mt-2 text-sm text-muted">
        <span className="font-medium text-secondary">{orgName}</span> is ready to go.
      </p>
      <button
        onClick={() => router.push("/dashboard")}
        className="mt-8 rounded-lg bg-action px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-action-hover"
      >
        Go to Dashboard
      </button>
    </div>
  );
}
