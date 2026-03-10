"use client";

import Link from "next/link";
import { PlatformSetupWizard } from "@/components/platform/PlatformSetupWizard";

export default function CreateOrgPage() {
  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Link href="/platform" className="text-muted hover:text-secondary transition-colors">
          Organizations
        </Link>
        <span className="text-faint">/</span>
        <span className="text-secondary">New Organization</span>
      </div>

      {/* Wizard */}
      <div className="max-w-4xl mx-auto">
        <PlatformSetupWizard />
      </div>
    </div>
  );
}
