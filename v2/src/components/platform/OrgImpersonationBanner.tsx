"use client";

import { useRouter } from "next/navigation";
import { useOrgContext } from "@/contexts/OrgContext";

export function OrgImpersonationBanner() {
  const router = useRouter();
  const { orgName, isPlatformView } = useOrgContext();

  if (!isPlatformView) return null;

  function exitPlatformView() {
    localStorage.removeItem("hedgelab-platform-org-id");
    router.push("/platform");
  }

  return (
    <div className="bg-action-20 border-b border-action/30 px-4 py-2 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center rounded-md bg-action px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
          Platform View
        </span>
        <span className="text-sm text-secondary">
          Viewing: <strong>{orgName}</strong>
        </span>
      </div>
      <button
        onClick={exitPlatformView}
        className="inline-flex items-center gap-1.5 rounded-md bg-action px-3 py-1 text-xs font-medium text-white hover:bg-action-hover transition-colors"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
        </svg>
        Exit to Platform
      </button>
    </div>
  );
}
