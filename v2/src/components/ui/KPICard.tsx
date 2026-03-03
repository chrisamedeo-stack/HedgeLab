"use client";

interface KPICardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  trend?: "up" | "down" | "neutral";
  icon?: React.ReactNode;
  className?: string;
}

export function KPICard({ label, value, subtitle, trend, icon, className = "" }: KPICardProps) {
  const trendColor =
    trend === "up" ? "text-profit" : trend === "down" ? "text-loss" : "text-muted";

  return (
    <div className={`rounded-lg border border-b-default bg-surface p-5 hover:border-b-input transition-colors ${className}`}>
      <div className="flex items-center gap-2">
        {icon && <span className="text-muted">{icon}</span>}
        <span className="text-xs font-medium uppercase tracking-wider text-faint">{label}</span>
      </div>
      <div className="mt-2 text-2xl font-bold text-primary tabular-nums">{value}</div>
      {subtitle && (
        <div className={`mt-1 text-xs ${trendColor}`}>{subtitle}</div>
      )}
    </div>
  );
}
