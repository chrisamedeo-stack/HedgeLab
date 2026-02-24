"use client";

import Link from "next/link";
import { CheckCircle2, Circle, MapPin, BookOpen, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

interface SetupWizardProps {
  hasSites: boolean;
  hasBudget: boolean;
  hasPositions: boolean;
}

const steps = [
  {
    key: "sites",
    label: "Create your first site",
    description: "Sites represent your physical plants or delivery locations.",
    href: "/settings",
    icon: MapPin,
  },
  {
    key: "budget",
    label: "Set up a budget",
    description: "Define monthly corn requirements for each site.",
    href: "/corn/budget",
    icon: BookOpen,
  },
  {
    key: "positions",
    label: "Book your first hedge",
    description: "Open a futures position to begin hedging your procurement.",
    href: "/corn/positions",
    icon: Activity,
  },
] as const;

export function SetupWizard({ hasSites, hasBudget, hasPositions }: SetupWizardProps) {
  const completion = [hasSites, hasBudget, hasPositions];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 max-w-2xl mx-auto">
      <h2 className="text-lg font-bold text-slate-100 mb-1">Welcome to HedgeLab</h2>
      <p className="text-sm text-slate-400 mb-6">
        Complete these steps to set up your corn procurement workflow.
      </p>

      <div className="space-y-4">
        {steps.map((step, i) => {
          const done = completion[i];
          const disabled = i === 1 ? !hasSites : i === 2 ? !hasBudget : false;
          const Icon = step.icon;

          return (
            <div key={step.key} className={cn(
              "flex items-start gap-4 p-4 rounded-lg border transition-colors",
              done
                ? "border-emerald-500/20 bg-emerald-500/5"
                : disabled
                ? "border-slate-800 bg-slate-950/50 opacity-50"
                : "border-slate-800 bg-slate-800/30 hover:border-slate-700"
            )}>
              <div className="mt-0.5">
                {done ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                ) : (
                  <Circle className="h-5 w-5 text-slate-600" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-slate-500" />
                  <p className={cn(
                    "text-sm font-medium",
                    done ? "text-emerald-300 line-through" : "text-slate-200"
                  )}>
                    {step.label}
                  </p>
                </div>
                <p className="text-xs text-slate-500 mt-1">{step.description}</p>
              </div>
              {!done && !disabled && (
                <Link
                  href={step.href}
                  className="shrink-0 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg transition-colors"
                >
                  Get started
                </Link>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-6 pt-4 border-t border-slate-800">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${(completion.filter(Boolean).length / 3) * 100}%` }}
            />
          </div>
          <span className="text-xs text-slate-500 tabular-nums">
            {completion.filter(Boolean).length}/3
          </span>
        </div>
      </div>
    </div>
  );
}
