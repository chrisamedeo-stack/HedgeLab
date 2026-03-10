"use client";

import { useEffect, useState } from "react";
import { useSetupStore } from "@/store/setupStore";
import type { CustomerProfile } from "@/types/org";

const PROFILE_ICONS: Record<string, string> = {
  consumer: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4",
  producer: "M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  merchandiser: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6",
  utility: "M13 10V3L4 14h7v7l9-11h-7z",
  cms: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
};

const MODEL_COLORS: Record<string, string> = {
  budget: "bg-action-10 text-action",
  margin: "bg-profit-10 text-profit",
};

export function ProfileStep() {
  const { profileId, setProfile, setStep } = useSetupStore();
  const [profiles, setProfiles] = useState<CustomerProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/kernel/customer-profiles")
      .then((r) => r.json())
      .then((data) => {
        setProfiles(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  function handleSelect(p: CustomerProfile) {
    setProfile(p.id, p);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-action border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-secondary">Choose Your Profile</h2>
        <p className="mt-1 text-sm text-muted">
          This pre-configures your plugins, hierarchy, and settings. Everything is editable later.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {profiles.map((p) => {
          const isSelected = profileId === p.id;
          const icon = PROFILE_ICONS[p.id] ?? PROFILE_ICONS.consumer;
          const modelColor = MODEL_COLORS[p.operating_model] ?? MODEL_COLORS.budget;

          return (
            <button
              key={p.id}
              onClick={() => handleSelect(p)}
              className={`flex flex-col rounded-xl border p-5 text-left transition-all ${
                isSelected
                  ? "border-action bg-action/10 ring-1 ring-action"
                  : "border-b-default bg-surface hover:border-hover hover:bg-hover"
              }`}
            >
              <div className="mb-3 flex items-center justify-between">
                <div className={`rounded-lg p-2 ${isSelected ? "bg-action/20 text-action" : "bg-input-bg text-muted"}`}>
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
                  </svg>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${modelColor}`}>
                  {p.operating_model}
                </span>
              </div>
              <h3 className="text-sm font-semibold text-secondary">{p.display_name}</h3>
              <p className="mt-1 flex-1 text-xs text-muted leading-relaxed">{p.description}</p>
              <div className="mt-3 text-xs text-faint">
                {p.default_plugins.length} plugins
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex justify-between pt-2">
        <button
          onClick={() => setStep(1)}
          className="rounded-lg border border-b-input px-5 py-2 text-sm text-muted transition-colors hover:bg-hover hover:text-secondary"
        >
          Back
        </button>
        <button
          onClick={() => setStep(3)}
          disabled={!profileId}
          className="rounded-lg bg-action px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-action-hover disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
    </div>
  );
}
