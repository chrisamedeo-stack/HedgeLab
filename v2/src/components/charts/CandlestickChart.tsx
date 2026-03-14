"use client";

import { useRef, useEffect, useMemo } from "react";
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  ColorType,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type HistogramData,
  type Time,
} from "lightweight-charts";
import { chartColors, chartTheme } from "@/lib/chartTheme";

export interface CandlestickDataPoint {
  time: string; // YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface VolumeDataPoint {
  time: string;
  value: number;
}

interface CandlestickChartProps {
  data: CandlestickDataPoint[];
  volume?: VolumeDataPoint[];
  height?: number;
  className?: string;
}

export function CandlestickChart({
  data,
  volume,
  height = 400,
  className = "",
}: CandlestickChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeRef = useRef<ISeriesApi<"Histogram"> | null>(null);

  // Sort data chronologically
  const sortedData = useMemo(
    () => [...data].sort((a, b) => a.time.localeCompare(b.time)),
    [data]
  );
  const sortedVolume = useMemo(
    () => (volume ? [...volume].sort((a, b) => a.time.localeCompare(b.time)) : undefined),
    [volume]
  );

  // Create chart on mount
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height,
      layout: {
        background: { type: ColorType.Solid, color: chartColors.surface },
        textColor: "#8B95A5",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: chartColors.grid },
        horzLines: { color: chartColors.grid },
      },
      crosshair: {
        vertLine: { color: chartColors.border, labelBackgroundColor: chartColors.surface },
        horzLine: { color: chartColors.border, labelBackgroundColor: chartColors.surface },
      },
      rightPriceScale: {
        borderColor: chartColors.border,
      },
      timeScale: {
        borderColor: chartColors.border,
        timeVisible: false,
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: chartTheme.candleUp,
      downColor: chartTheme.candleDown,
      borderDownColor: chartTheme.candleDown,
      borderUpColor: chartTheme.candleUp,
      wickDownColor: chartTheme.candleWick,
      wickUpColor: chartTheme.candleWick,
    });

    chartRef.current = chart;
    candleRef.current = candleSeries;

    if (sortedVolume && sortedVolume.length > 0) {
      const volumeSeries = chart.addSeries(HistogramSeries, {
        color: chartColors.chart2,
        priceFormat: { type: "volume" },
        priceScaleId: "volume",
      });
      chart.priceScale("volume").applyOptions({
        scaleMargins: { top: 0.8, bottom: 0 },
      });
      volumeRef.current = volumeSeries;
    }

    // Handle resize
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        chart.applyOptions({ width: entry.contentRect.width });
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      candleRef.current = null;
      volumeRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height]);

  // Update data
  useEffect(() => {
    if (candleRef.current && sortedData.length > 0) {
      candleRef.current.setData(sortedData as CandlestickData<Time>[]);
      chartRef.current?.timeScale().fitContent();
    }
  }, [sortedData]);

  useEffect(() => {
    if (volumeRef.current && sortedVolume && sortedVolume.length > 0) {
      const coloredVolume: HistogramData<Time>[] = sortedVolume.map((v, i) => {
        const candle = sortedData[i];
        const isUp = candle ? candle.close >= candle.open : true;
        return {
          time: v.time as unknown as Time,
          value: v.value,
          color: isUp ? `${chartTheme.candleUp}40` : `${chartTheme.candleDown}40`,
        };
      });
      volumeRef.current.setData(coloredVolume);
    }
  }, [sortedVolume, sortedData]);

  if (data.length === 0) {
    return (
      <div className={`flex items-center justify-center bg-surface border border-b-default rounded-lg ${className}`} style={{ height }}>
        <div className="text-center">
          <svg className="h-10 w-10 text-faint mb-2 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
          </svg>
          <span className="text-sm text-faint">No OHLC data available</span>
        </div>
      </div>
    );
  }

  return <div ref={containerRef} className={`rounded-lg overflow-hidden ${className}`} />;
}
