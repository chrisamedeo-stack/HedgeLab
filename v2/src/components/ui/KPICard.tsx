"use client";

interface KPICardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  trend?: "up" | "down" | "neutral";
  className?: string;
}

export function KPICard({ label, value, subtitle, trend, className = "" }: KPICardProps) {
  const trendColor =
    trend === "up" ? "text-profit" : trend === "down" ? "text-loss" : "text-muted";

  return (
    <div className={`rounded-lg border border-b-default bg-surface px-4 py-3 ${className}`}>
      <div className="text-xs font-medium text-faint">{label}</div>
      <div className="mt-1 text-2xl font-bold text-primary tabular-nums">{value}</div>
      {subtitle && (
        <div className={`mt-0.5 text-xs ${trendColor}`}>{subtitle}</div>
      )}
    </div>
  );
}
