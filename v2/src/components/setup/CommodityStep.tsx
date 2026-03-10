"use client";

import { useEffect, useState } from "react";
import { useSetupStore } from "@/store/setupStore";

interface Commodity {
  id: string;
  name: string;
  category: string;
  exchange: string;
  unit: string;
}

export function CommodityStep() {
  const { selectedCommodities, setCommodities, setStep } = useSetupStore();
  const [commodities, setCommoditiesList] = useState<Commodity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/kernel/commodities")
      .then((r) => r.json())
      .then((data: Commodity[]) => {
        setCommoditiesList(data);
        // Pre-select all if none selected yet
        if (selectedCommodities.length === 0) {
          setCommodities(data.map((c) => c.id));
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function toggle(id: string) {
    if (selectedCommodities.includes(id)) {
      setCommodities(selectedCommodities.filter((c) => c !== id));
    } else {
      setCommodities([...selectedCommodities, id]);
    }
  }

  function selectAll() {
    setCommodities(commodities.map((c) => c.id));
  }

  function selectNone() {
    setCommodities([]);
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
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-secondary">Select Commodities</h2>
          <p className="mt-1 text-sm text-muted">
            Choose which commodities your organization trades. You can add more later.
          </p>
        </div>
        <div className="flex gap-2 text-xs">
          <button onClick={selectAll} className="text-action hover:text-action-hover transition-colors">
            Select All
          </button>
          <span className="text-faint">/</span>
          <button onClick={selectNone} className="text-muted hover:text-secondary transition-colors">
            None
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {commodities.map((c) => {
          const isSelected = selectedCommodities.includes(c.id);
          return (
            <button
              key={c.id}
              onClick={() => toggle(c.id)}
              className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-all ${
                isSelected
                  ? "border-action bg-action/10 ring-1 ring-action"
                  : "border-b-default bg-surface hover:border-hover hover:bg-hover"
              }`}
            >
              <div className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded border transition-colors ${
                isSelected
                  ? "border-action bg-action text-white"
                  : "border-b-input bg-input-bg"
              }`}>
                {isSelected && (
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-secondary">{c.name}</div>
                <div className="mt-0.5 text-xs text-muted">
                  {c.category} · {c.exchange} · {c.unit}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex justify-between pt-2">
        <button
          onClick={() => setStep(3)}
          className="rounded-lg border border-b-input px-5 py-2 text-sm text-muted transition-colors hover:bg-hover hover:text-secondary"
        >
          Back
        </button>
        <button
          onClick={() => setStep(5)}
          disabled={selectedCommodities.length === 0}
          className="rounded-lg bg-action px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-action-hover disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
    </div>
  );
}
