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
    <div className="bg-surface border border-b-default rounded-lg p-8 max-w-2xl mx-auto">
      <h2 className="text-lg font-bold text-primary mb-1">Welcome to HedgeLab</h2>
      <p className="text-sm text-muted mb-6">
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
                ? "border-profit-20 bg-profit-5"
                : disabled
                ? "border-b-default bg-main/50 opacity-50"
                : "border-b-default bg-input-bg/30 hover:border-b-input"
            )}>
              <div className="mt-0.5">
                {done ? (
                  <CheckCircle2 className="h-5 w-5 text-profit" />
                ) : (
                  <Circle className="h-5 w-5 text-ph" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-faint" />
                  <p className={cn(
                    "text-sm font-medium",
                    done ? "text-profit line-through" : "text-secondary"
                  )}>
                    {step.label}
                  </p>
                </div>
                <p className="text-xs text-faint mt-1">{step.description}</p>
              </div>
              {!done && !disabled && (
                <Link
                  href={step.href}
                  className="shrink-0 px-3 py-1.5 bg-action hover:bg-action-hover text-white text-xs font-medium rounded-lg transition-colors"
                >
                  Get started
                </Link>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-6 pt-4 border-t border-b-default">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-input-bg rounded-full overflow-hidden">
            <div
              className="h-full bg-profit rounded-full transition-all duration-500"
              style={{ width: `${(completion.filter(Boolean).length / 3) * 100}%` }}
            />
          </div>
          <span className="text-xs text-faint tabular-nums">
            {completion.filter(Boolean).length}/3
          </span>
        </div>
      </div>
    </div>
  );
}
