"use client";

type HighlightVariant = "destructive" | "profit" | "action" | "warning" | "caution";

const highlightStyles: Record<HighlightVariant, string> = {
  destructive: "border-destructive-30 bg-destructive-5",
  profit:      "border-profit-30 bg-profit-5",
  action:      "border-action-30 bg-action-5",
  warning:     "border-warning-30 bg-warning-5",
  caution:     "border-caution-30 bg-caution-5",
};

interface KPICardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  trend?: "up" | "down" | "neutral";
  icon?: React.ReactNode;
  highlight?: HighlightVariant;
  className?: string;
  valueClassName?: string;
}

export function KPICard({ label, value, subtitle, trend, icon, highlight, className = "", valueClassName }: KPICardProps) {
  const trendColor =
    trend === "up" ? "text-profit" : trend === "down" ? "text-loss" : "text-muted";

  const borderBg = highlight
    ? highlightStyles[highlight]
    : "border-b-default bg-surface";

  return (
    <div className={`rounded-lg border ${borderBg} p-5 hover:border-b-input transition-colors group ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-muted uppercase tracking-wider">{label}</span>
        {icon && <span className={highlight ? `text-${highlight}` : "text-ph group-hover:text-muted"}>{icon}</span>}
      </div>
      <div className={`text-2xl font-bold tabular-nums ${valueClassName ?? "text-primary"}`}>{value}</div>
      {subtitle && (
        <div className={`mt-1 text-xs ${trendColor}`}>{subtitle}</div>
      )}
    </div>
  );
}
