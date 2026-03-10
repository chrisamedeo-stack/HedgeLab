"use client";

const STEPS = [
  { num: 1, label: "Organization" },
  { num: 2, label: "Profile" },
  { num: 3, label: "Structure" },
  { num: 4, label: "Commodities" },
  { num: 5, label: "Review" },
];

export function StepIndicator({ current }: { current: number }) {
  return (
    <div className="mb-8 flex items-center justify-center gap-1">
      {STEPS.map((step, i) => {
        const isActive = step.num === current;
        const isDone = step.num < current;
        return (
          <div key={step.num} className="flex items-center">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium transition-colors ${
                isActive
                  ? "bg-action text-white"
                  : isDone
                    ? "bg-profit-20 text-profit border border-profit-20"
                    : "bg-input-bg text-faint border border-b-default"
              }`}
            >
              {isDone ? (
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                step.num
              )}
            </div>
            <span
              className={`ml-1.5 text-xs ${
                isActive ? "font-medium text-secondary" : "text-faint"
              }`}
            >
              {step.label}
            </span>
            {i < STEPS.length - 1 && (
              <div
                className={`mx-3 h-px w-8 ${
                  isDone ? "bg-profit-20" : "bg-hover"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
