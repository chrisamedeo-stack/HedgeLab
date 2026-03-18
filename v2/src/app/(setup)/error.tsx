"use client";

export default function SetupError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="w-full max-w-md rounded-xl border border-b-default bg-surface p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive-10">
          <svg className="h-6 w-6 text-loss" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-primary">Something went wrong</h2>
        <p className="mt-2 text-sm text-muted">{error.message}</p>
        <button
          onClick={reset}
          className="mt-6 rounded-lg bg-action px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-action-hover"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
