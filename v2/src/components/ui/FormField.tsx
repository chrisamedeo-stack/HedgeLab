"use client";

interface FormFieldProps {
  label: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function FormField({ label, error, required, className = "", children }: FormFieldProps) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-muted mb-1">
        {label}{required && <span className="text-loss ml-0.5">*</span>}
      </label>
      {children}
      {error && (
        <p className="mt-1 text-xs text-loss animate-fade-in">{error}</p>
      )}
    </div>
  );
}
