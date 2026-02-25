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
      <label className="text-xs text-muted">{label}</label>
      {children}
      {error && (
        <p className="text-xs text-destructive animate-fade-in">{error}</p>
      )}
    </div>
  );
}
