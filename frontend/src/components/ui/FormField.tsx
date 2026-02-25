import { cn } from "@/lib/utils";

interface FormFieldProps {
  label: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}

export function FormField({ label, error, className, children }: FormFieldProps) {
  return (
    <div className={cn("space-y-1", className)}>
      <label className="text-xs text-slate-400">{label}</label>
      {children}
      {error && (
        <p className="text-xs text-red-400 animate-fade-in">{error}</p>
      )}
    </div>
  );
}
