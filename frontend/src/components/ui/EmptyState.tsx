import { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 rounded-full bg-input-bg/60 p-5">
        <Icon className="h-8 w-8 text-ph" strokeWidth={1.5} />
      </div>
      <h3 className="text-sm font-semibold text-secondary">{title}</h3>
      {description && (
        <p className="mt-1 text-sm text-faint max-w-xs">{description}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 px-4 py-2 text-sm font-medium bg-action hover:bg-action-hover text-white rounded-lg transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
