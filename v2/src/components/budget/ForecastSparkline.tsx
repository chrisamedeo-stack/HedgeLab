"use client";

import { LineChart, Line, ResponsiveContainer } from "recharts";
import type { ForecastHistoryEntry } from "@/types/budget";

interface ForecastSparklineProps {
  history: ForecastHistoryEntry[];
}

export function ForecastSparkline({ history }: ForecastSparklineProps) {
  if (!history || history.length < 2) {
    return <span className="text-xs text-faint">—</span>;
  }

  // Reverse so oldest is on left
  const data = [...history]
    .reverse()
    .map((h) => ({ v: h.forecast_volume != null ? Number(h.forecast_volume) : 0 }));

  return (
    <div style={{ width: 80, height: 24 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <Line
            type="monotone"
            dataKey="v"
            stroke="#378ADD"
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
