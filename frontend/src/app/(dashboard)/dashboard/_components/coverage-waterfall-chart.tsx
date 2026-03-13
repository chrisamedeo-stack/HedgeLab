"use client";

import { useMemo, useState, useRef, useEffect, useCallback } from "react";
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
import type { CoverageResponse } from "@/hooks/useCorn";
import { BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

Chart.register(BarController, BarElement, CategoryScale, LinearScale, ChartTooltip);

// ─── Types ──────────────────────────────────────────────────────────────────

type TimeRange = "3" | "6" | "12" | "all";

interface ChartRow {
  month: string;
  label: string;
  basis: number;
  board: number;
  forecast: number;
  budget: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BUSHELS_PER_MT = 39.3683;

function monthLabel(ym: string) {
  if (!ym || ym.length < 7) return ym;
  return new Date(ym + "-01").toLocaleString("en-US", { month: "short", year: "2-digit" });
}

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function addMonths(ym: string, n: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function fmtK(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `${Math.round(v / 1_000)}k`;
  return String(v);
}

function fmtComma(v: number): string {
  return v.toLocaleString("en-US");
}

// ─── Theme ──────────────────────────────────────────────────────────────────

function isDark(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-color-scheme: dark)").matches || true;
}

function themeColors() {
  const dark = isDark();
  return {
    basisBar: "#B5D4F4",
    boardBar: "#1a6b7a",
    budgetLine: "#0C447C",
    forecastFill: dark ? "rgba(181,212,244,0.1)" : "rgba(181,212,244,0.22)",
    forecastBorder: dark ? "rgba(181,212,244,0.2)" : "rgba(181,212,244,0.4)",
    gridColor: dark ? "rgba(181,212,244,0.08)" : "rgba(0,0,0,0.08)",
    tickColor: dark ? "#7B90AE" : "#555",
    tooltipBg: dark ? "#003366" : "#fff",
    tooltipBorder: dark ? "#00509e" : "#ccc",
    tooltipText: dark ? "#cce0ff" : "#111",
  };
}

// ─── Forecast container plugin ──────────────────────────────────────────────

const forecastContainerPlugin: Plugin<"bar"> = {
  id: "forecastContainer",
  beforeDatasetsDraw(chart) {
    const { ctx } = chart;
    const meta0 = chart.getDatasetMeta(0);
    const meta1 = chart.getDatasetMeta(1);
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

      const leftX = Math.min(bar0.x - bar0.width / 2, bar1.x - bar1.width / 2);
      const rightX = Math.max(bar0.x + bar0.width / 2, bar1.x + bar1.width / 2);

      const pad = 4;
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(leftX - pad, yTop, rightX - leftX + pad * 2, yBottom - yTop, 4);
      ctx.fillStyle = colors.forecastFill;
      ctx.fill();
      ctx.strokeStyle = colors.forecastBorder;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }
  },
};

// ─── Budget line plugin ─────────────────────────────────────────────────────

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

// ─── Component ──────────────────────────────────────────────────────────────

interface Props {
  coverage: CoverageResponse[];
  filterSiteCodes?: string[];
}

export function CoverageWaterfallChart({ coverage, filterSiteCodes }: Props) {
  const [timeRange, setTimeRange] = useState<TimeRange>("all");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart<"bar"> | null>(null);

  const allData = useMemo(() => {
    const buckets = new Map<
      string,
      { budgetedMt: number; hedgedMt: number; efpdMt: number }
    >();

    const filtered = filterSiteCodes
      ? coverage.filter((c) => filterSiteCodes.includes(c.siteCode))
      : coverage;

    for (const site of filtered) {
      for (const m of site.months ?? []) {
        const cur = buckets.get(m.month) ?? { budgetedMt: 0, hedgedMt: 0, efpdMt: 0 };
        cur.budgetedMt += m.budgetedMt ?? 0;
        cur.hedgedMt += m.hedgedMt ?? 0;
        cur.efpdMt += m.efpdMt ?? 0;
        buckets.set(m.month, cur);
      }
    }

    return Array.from(buckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, d]): ChartRow => {
        const basis = d.efpdMt * BUSHELS_PER_MT;
        const board = d.hedgedMt * BUSHELS_PER_MT;
        const forecast = d.budgetedMt * BUSHELS_PER_MT;
        const budget = d.budgetedMt * BUSHELS_PER_MT;
        return { month, label: monthLabel(month), basis, board, forecast, budget };
      });
  }, [coverage, filterSiteCodes]);

  const data = useMemo(() => {
    if (timeRange === "all") return allData;
    const cur = currentMonth();
    const end = addMonths(cur, parseInt(timeRange));
    return allData.filter((d) => d.month >= cur && d.month < end);
  }, [allData, timeRange]);

  const buildChart = useCallback(() => {
    if (!canvasRef.current || data.length === 0) return;

    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    const colors = themeColors();
    const labels = data.map((d) => d.label);
    const basisValues = data.map((d) => d.basis);
    const boardValues = data.map((d) => d.board);
    const forecastValues = data.map((d) => d.forecast);
    const budgetValues = data.map((d) => d.budget);

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
        interaction: { mode: "index", intersect: false },
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
              label(ctx) {
                return ` ${ctx.dataset.label}: ${fmtComma(ctx.parsed.y ?? 0)} bu`;
              },
              afterBody(items) {
                if (!items[0]) return [];
                const idx = items[0].dataIndex;
                const lines: string[] = [];
                if (forecastValues[idx]) lines.push(` Forecast: ${fmtComma(forecastValues[idx])} bu`);
                if (budgetValues[idx]) lines.push(` Budget: ${fmtComma(budgetValues[idx])} bu`);
                return lines;
              },
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: colors.tickColor, font: { size: 11 }, autoSkip: false, maxRotation: 45, minRotation: 0 },
            border: { display: false },
          },
          y: {
            grid: { color: colors.gridColor },
            ticks: {
              color: colors.tickColor,
              font: { size: 11 },
              callback(tickValue) { return fmtK(Number(tickValue)); },
            },
            border: { display: false },
            beginAtZero: true,
          },
        },
      },
      plugins: [forecastContainerPlugin, budgetLinePlugin],
    };

    const chart = new Chart(canvasRef.current, config);
    (chart.config as unknown as { _forecastValues: number[] })._forecastValues = forecastValues;
    (chart.config as unknown as { _budgetValues: number[] })._budgetValues = budgetValues;
    chart.update();
    chartRef.current = chart;
  }, [data]);

  useEffect(() => {
    buildChart();
    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [buildChart]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => buildChart();
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [buildChart]);

  // ─── Empty state ──────────────────────────────────────────────────────────
  if (allData.length === 0) {
    return (
      <div className="bg-surface border border-b-default rounded-lg p-5">
        <h3 className="text-sm font-semibold text-secondary uppercase tracking-wider mb-4">
          Coverage by Month
        </h3>
        <div className="h-48 flex flex-col items-center justify-center text-ph">
          <BarChart3 className="h-8 w-8 mb-2" />
          <p className="text-sm">No coverage data yet</p>
        </div>
      </div>
    );
  }

  const ranges: { label: string; value: TimeRange }[] = [
    { label: "3 Mo", value: "3" },
    { label: "6 Mo", value: "6" },
    { label: "12 Mo", value: "12" },
    { label: "All", value: "all" },
  ];

  return (
    <div className="bg-surface border border-b-default rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-secondary uppercase tracking-wider">
          Coverage by Month
        </h3>
        <div className="flex gap-0.5 p-0.5 bg-input-bg border border-b-input rounded-lg">
          {ranges.map((r) => (
            <button
              key={r.value}
              onClick={() => setTimeRange(r.value)}
              className={cn(
                "px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                timeRange === r.value
                  ? "bg-action text-white"
                  : "text-muted hover:text-secondary"
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom legend */}
      <div className="flex items-center gap-4 mb-3 text-[10px] text-muted">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-2 rounded-sm" style={{ background: "#B5D4F4" }} />
          Basis
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-2 rounded-sm" style={{ background: "#1a6b7a" }} />
          Board
        </span>
        <span className="flex items-center gap-1">
          <span
            className="inline-block w-3 h-2 rounded-sm"
            style={{ background: "rgba(181,212,244,0.1)", border: "1px solid rgba(181,212,244,0.3)" }}
          />
          Forecast
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-4 h-0" style={{ borderTop: "2.5px solid #0C447C" }} />
          Budget
        </span>
      </div>

      <div className="h-52">
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
