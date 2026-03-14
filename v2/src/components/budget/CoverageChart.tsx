"use client";

import { useRef, useEffect, useCallback } from "react";
import {
  Chart,
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip as ChartTooltip,
  type ChartConfiguration,
  type Plugin,
} from "chart.js";
import type { CoverageDataPoint } from "@/types/budget";

// Register only what we need
Chart.register(BarController, BarElement, CategoryScale, LinearScale, ChartTooltip);

// ─── Types ───────────────────────────────────────────────────────────────────

interface CoverageChartProps {
  data: CoverageDataPoint[];
  height?: number;
  commodityId?: string;
}

// ─── Theme helpers ───────────────────────────────────────────────────────────

function isDark(): boolean {
  if (typeof window === "undefined") return true;
  // App is always dark-themed, but respect prefers-color-scheme if set
  return window.matchMedia("(prefers-color-scheme: dark)").matches || true;
}

function themeColors() {
  const dark = isDark();
  return {
    basisBar: "#6A9FCC",
    boardBar: "#1a6b7a",
    budgetLine: "#EF9F27",
    forecastFill: dark ? "rgba(181,212,244,0.1)" : "rgba(181,212,244,0.22)",
    forecastBorder: dark ? "rgba(181,212,244,0.2)" : "rgba(181,212,244,0.4)",
    gridColor: dark ? "rgba(181,212,244,0.08)" : "rgba(0,0,0,0.08)",
    tickColor: dark ? "#8B95A5" : "#555",
    tooltipBg: dark ? "#040C17" : "#fff",
    tooltipBorder: dark ? "#2B4362" : "#ccc",
    tooltipText: dark ? "#E8ECF1" : "#111",
  };
}

// ─── Format helpers ──────────────────────────────────────────────────────────

function fmtK(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `${Math.round(v / 1_000)}k`;
  return String(v);
}

function fmtMonth(m: string): string {
  const d = new Date(m + "-01");
  if (isNaN(d.getTime())) return m;
  return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

function fmtComma(v: number): string {
  return v.toLocaleString("en-US");
}

// ─── Forecast container plugin ───────────────────────────────────────────────

const forecastContainerPlugin: Plugin<"bar"> = {
  id: "forecastContainer",
  beforeDatasetsDraw(chart) {
    const { ctx } = chart;
    const meta0 = chart.getDatasetMeta(0); // basis
    const meta1 = chart.getDatasetMeta(1); // board
    if (!meta0?.data?.length || !meta1?.data?.length) return;

    const colors = themeColors();
    const yScale = chart.scales.y;
    const forecastData = (chart.config as unknown as { _forecastValues?: number[] })._forecastValues;
    if (!forecastData) return;

    for (let i = 0; i < meta0.data.length; i++) {
      const bar0 = meta0.data[i] as unknown as { x: number; width: number };
      const bar1 = meta1.data[i] as unknown as { x: number; width: number };
      if (!bar0 || !bar1) continue;

      const forecastVal = forecastData[i] ?? 0;
      if (forecastVal <= 0) continue;

      const yTop = yScale.getPixelForValue(forecastVal);
      const yBottom = yScale.getPixelForValue(0);

      // Get combined bar group bounds
      const leftX = Math.min(bar0.x - bar0.width / 2, bar1.x - bar1.width / 2);
      const rightX = Math.max(bar0.x + bar0.width / 2, bar1.x + bar1.width / 2);

      const pad = 4;
      const x = leftX - pad;
      const y = yTop;
      const w = rightX - leftX + pad * 2;
      const h = yBottom - yTop;
      const r = 4;

      ctx.save();
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
      ctx.fillStyle = colors.forecastFill;
      ctx.fill();
      ctx.strokeStyle = colors.forecastBorder;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }
  },
};

// ─── Budget line plugin ──────────────────────────────────────────────────────

const budgetLinePlugin: Plugin<"bar"> = {
  id: "budgetLine",
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    const meta0 = chart.getDatasetMeta(0);
    const meta1 = chart.getDatasetMeta(1);
    if (!meta0?.data?.length || !meta1?.data?.length) return;

    const colors = themeColors();
    const yScale = chart.scales.y;
    const budgetData = (chart.config as unknown as { _budgetValues?: number[] })._budgetValues;
    if (!budgetData) return;

    for (let i = 0; i < meta0.data.length; i++) {
      const bar0 = meta0.data[i] as unknown as { x: number; width: number };
      const bar1 = meta1.data[i] as unknown as { x: number; width: number };
      if (!bar0 || !bar1) continue;

      const budgetVal = budgetData[i] ?? 0;
      if (budgetVal <= 0) continue;

      const yPos = yScale.getPixelForValue(budgetVal);

      const leftX = Math.min(bar0.x - bar0.width / 2, bar1.x - bar1.width / 2);
      const rightX = Math.max(bar0.x + bar0.width / 2, bar1.x + bar1.width / 2);

      const pad = 4;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(leftX - pad, yPos);
      ctx.lineTo(rightX + pad, yPos);
      ctx.strokeStyle = colors.budgetLine;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.restore();
    }
  },
};

// ─── Legend component ────────────────────────────────────────────────────────

function CoverageLegend() {
  return (
    <div className="flex items-center gap-5 mb-3 px-1">
      <div className="flex items-center gap-1.5">
        <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: "#6A9FCC" }} />
        <span className="text-xs text-muted">Basis</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: "#1a6b7a" }} />
        <span className="text-xs text-muted">Board</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span
          className="inline-block w-3 h-3 rounded-sm"
          style={{
            backgroundColor: "rgba(181,212,244,0.1)",
            border: "1px solid rgba(181,212,244,0.3)",
          }}
        />
        <span className="text-xs text-muted">Forecast</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span
          className="inline-block w-4 h-0 rounded"
          style={{ borderTop: "2.5px solid #EF9F27" }}
        />
        <span className="text-xs text-muted">Budget</span>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function CoverageChart({ data, height = 320, commodityId }: CoverageChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart<"bar"> | null>(null);

  const buildChart = useCallback(() => {
    if (!canvasRef.current) return;

    // Destroy previous instance
    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    const filtered = commodityId
      ? data
      : data; // filtering by commodityId handled upstream

    if (filtered.length === 0) return;

    const colors = themeColors();
    const labels = filtered.map((d) => fmtMonth(d.month));

    // Data mapping:
    // Basis = committed (physical basis contracts)
    // Board = hedged (futures/board trades)
    // Forecast = budgeted (total target — the container)
    // Budget = budgeted (the horizontal line)
    const basisValues = filtered.map((d) => Number(d.committed));
    const boardValues = filtered.map((d) => Number(d.hedged));
    const forecastValues = filtered.map((d) => Number(d.budgeted));
    const budgetValues = filtered.map((d) => Number(d.budgeted));

    const config: ChartConfiguration<"bar"> = {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Basis",
            data: basisValues,
            backgroundColor: colors.basisBar,
            borderRadius: 3,
            barPercentage: 0.65,
            categoryPercentage: 0.85,
            order: 2,
          },
          {
            label: "Board",
            data: boardValues,
            backgroundColor: colors.boardBar,
            borderRadius: 3,
            barPercentage: 0.65,
            categoryPercentage: 0.85,
            order: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: "index",
          intersect: false,
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: colors.tooltipBg,
            borderColor: colors.tooltipBorder,
            borderWidth: 1,
            titleColor: colors.tooltipText,
            bodyColor: colors.tooltipText,
            titleFont: { size: 12, weight: "bold" },
            bodyFont: { size: 11 },
            padding: 10,
            cornerRadius: 2,
            callbacks: {
              title(items) {
                return items[0]?.label ?? "";
              },
              label(ctx) {
                const val = ctx.parsed.y ?? 0;
                return ` ${ctx.dataset.label}: ${fmtComma(val)} bu`;
              },
              afterBody(items) {
                if (!items[0]) return [];
                const idx = items[0].dataIndex;
                const lines: string[] = [];
                if (forecastValues[idx]) {
                  lines.push(` Forecast: ${fmtComma(forecastValues[idx])} bu`);
                }
                if (budgetValues[idx]) {
                  lines.push(` Budget: ${fmtComma(budgetValues[idx])} bu`);
                }
                return lines;
              },
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              color: colors.tickColor,
              font: { size: 11 },
              autoSkip: false,
              maxRotation: 45,
              minRotation: 0,
            },
            border: { display: false },
          },
          y: {
            grid: {
              color: colors.gridColor,
            },
            ticks: {
              color: colors.tickColor,
              font: { size: 11 },
              callback(tickValue) {
                return fmtK(Number(tickValue));
              },
            },
            border: { display: false },
            beginAtZero: true,
          },
        },
      },
      plugins: [forecastContainerPlugin, budgetLinePlugin],
    };

    const chart = new Chart(canvasRef.current, config);

    // Attach custom data for plugins
    (chart.config as unknown as { _forecastValues: number[] })._forecastValues = forecastValues;
    (chart.config as unknown as { _budgetValues: number[] })._budgetValues = budgetValues;

    // Force a re-render so plugins pick up the values
    chart.update();

    chartRef.current = chart;
  }, [data, commodityId]);

  useEffect(() => {
    buildChart();
    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [buildChart]);

  // Listen for color scheme changes
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => buildChart();
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [buildChart]);

  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border border-b-default bg-surface"
        style={{ height }}
      >
        <span className="text-sm text-faint">No coverage data available</span>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-b-default bg-surface p-4">
      <CoverageLegend />
      <div style={{ height }}>
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
