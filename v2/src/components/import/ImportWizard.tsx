"use client";

import { useImportStore } from "@/store/importStore";
import { TargetPicker } from "./TargetPicker";
import { FileUpload } from "./FileUpload";
import { ColumnMapper } from "./ColumnMapper";
import { ValidationReview } from "./ValidationReview";

const STEPS = [
  { num: 1, label: "Target" },
  { num: 2, label: "Upload" },
  { num: 3, label: "Map" },
  { num: 4, label: "Review" },
  { num: 5, label: "Done" },
];

// TODO: Replace with real org/user context from auth
const DEMO_ORG_ID = "00000000-0000-0000-0000-000000000001";
const DEMO_USER_ID = "00000000-0000-0000-0000-000000000001";

function StepIndicator({ current }: { current: number }) {
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

function CompletionView() {
  const { commitResult, fileName, targetTable, reset } = useImportStore();

  return (
    <div className="flex flex-col items-center py-12">
      <div className="mb-4 rounded-full bg-profit-10 p-4 text-profit">
        <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h3 className="text-xl font-semibold text-secondary">Import Complete</h3>
      <div className="mt-2 text-sm text-muted">
        <span className="font-medium text-profit">{commitResult?.committed ?? 0}</span> rows
        committed from <span className="font-medium text-secondary">{fileName}</span> to{" "}
        <span className="font-mono text-secondary">{targetTable}</span>
      </div>
      {(commitResult?.skipped ?? 0) > 0 && (
        <div className="mt-1 text-xs text-faint">
          {commitResult?.skipped} rows skipped due to errors
        </div>
      )}
      <div className="mt-8 flex gap-3">
        <button
          onClick={reset}
          className="rounded-md bg-action px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-action-hover"
        >
          New Import
        </button>
        <a
          href="/import"
          className="rounded-md border border-b-input px-4 py-2 text-sm font-medium text-secondary transition-colors hover:bg-hover"
        >
          View History
        </a>
      </div>
    </div>
  );
}

export function ImportWizard() {
  const { step, setStep, stageAndValidate, loading, error, clearError } = useImportStore();

  const canGoBack = step > 1 && step < 5;
  const canGoNext = step === 3; // Only the mapping step has a manual "next" button

  return (
    <div>
      <StepIndicator current={step} />

      {/* Error banner */}
      {error && (
        <div className="mb-4 flex items-center justify-between rounded-md border border-destructive-20 bg-destructive-10 px-4 py-2.5">
          <span className="text-sm text-loss">{error}</span>
          <button onClick={clearError} className="text-xs text-loss hover:text-loss">
            Dismiss
          </button>
        </div>
      )}

      {/* Step content */}
      <div className="min-h-[300px]">
        {step === 1 && <TargetPicker />}
        {step === 2 && <FileUpload />}
        {step === 3 && <ColumnMapper orgId={DEMO_ORG_ID} userId={DEMO_USER_ID} />}
        {step === 4 && <ValidationReview orgId={DEMO_ORG_ID} userId={DEMO_USER_ID} />}
        {step === 5 && <CompletionView />}
      </div>

      {/* Navigation */}
      {step < 5 && (
        <div className="mt-6 flex items-center justify-between border-t border-b-default pt-4">
          <button
            onClick={() => setStep((step - 1) as 1 | 2 | 3 | 4 | 5)}
            disabled={!canGoBack}
            className="rounded-md border border-b-input px-4 py-2 text-sm text-muted transition-colors hover:bg-hover hover:text-secondary disabled:invisible"
          >
            Back
          </button>
          {canGoNext && (
            <button
              onClick={() => stageAndValidate(DEMO_ORG_ID, DEMO_USER_ID)}
              disabled={loading}
              className="rounded-md bg-action px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-action-hover disabled:opacity-50"
            >
              {loading ? "Validating..." : "Validate & Review"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
