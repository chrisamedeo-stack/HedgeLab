"use client";

import { useState, useMemo, useEffect } from "react";
import { X } from "lucide-react";
import { useSites } from "@/hooks/useCorn";
import { useSuppliers } from "@/hooks/useSettings";
import { api } from "@/lib/api";
import {
  BUSHELS_PER_MT,
  suggestFuturesMonth,
  generateMonthRange,
  monthLabel,
} from "@/lib/corn-utils";
import { useToast } from "@/contexts/ToastContext";
import { btnPrimary, btnCancel } from "@/lib/corn-format";

type MRow = { volume: string; futuresRef: string; notes: string };

export function MultiMonthContractGrid({ onSaved, onCancel }: { onSaved: () => void; onCancel: () => void }) {
  const { sites } = useSites();
  const { suppliers } = useSuppliers();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const [config, setConfig] = useState({
    siteCode: "",
    supplierName: "",
    tradeType: "BASIS" as "INDEX" | "BASIS" | "ALL_IN",
    currency: "USD",
    startMonth: defaultMonth,
    endMonth: `${now.getFullYear()}-12`,
    contractDate: now.toISOString().slice(0, 10),
  });

  const [pricing, setPricing] = useState({
    basisBu: "",
    freightPerMt: "",
    boardPriceBu: "",
  });

  const [defaultVolume, setDefaultVolume] = useState("");
  const [rows, setRows] = useState<Record<string, MRow>>({});

  const isAllIn = config.tradeType === "ALL_IN";

  const months = useMemo(() => {
    if (isAllIn) return config.startMonth ? [config.startMonth] : [];
    if (config.startMonth && config.endMonth && config.endMonth >= config.startMonth) {
      return generateMonthRange(config.startMonth, config.endMonth);
    }
    return [];
  }, [config.startMonth, config.endMonth, isAllIn]);

  // Sync rows when months change — preserve existing data, add defaults for new months
  useEffect(() => {
    setRows((prev) => {
      const next: Record<string, MRow> = {};
      for (const m of months) {
        next[m] = prev[m] ?? { volume: defaultVolume, futuresRef: suggestFuturesMonth(m), notes: "" };
      }
      return next;
    });
  }, [months]); // eslint-disable-line react-hooks/exhaustive-deps

  function updateRow(m: string, f: keyof MRow, v: string) {
    setRows((r) => ({ ...r, [m]: { ...r[m], [f]: v } }));
  }

  function applyAll(v: string) {
    setDefaultVolume(v);
    setRows((r) =>
      Object.fromEntries(Object.entries(r).map(([m, row]) => [m, { ...row, volume: v }]))
    );
  }

  const totalBu = useMemo(() => {
    let total = 0;
    for (const m of months) {
      total += parseFloat(rows[m]?.volume) || 0;
    }
    return total;
  }, [months, rows]);

  const filledCount = months.filter((m) => parseFloat(rows[m]?.volume) > 0).length;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!config.siteCode) { toast("Select a site", "error"); return; }
    if (!isAllIn && config.endMonth < config.startMonth) { toast("End month must be \u2265 start month", "error"); return; }

    const basisVal = parseFloat(pricing.basisBu);
    const boardVal = parseFloat(pricing.boardPriceBu);
    const freightVal = parseFloat(pricing.freightPerMt);

    const lines = months
      .filter((m) => parseFloat(rows[m]?.volume) > 0)
      .map((m) => {
        const bu = parseFloat(rows[m].volume);
        return {
          siteCode: config.siteCode,
          supplierName: config.supplierName || null,
          deliveryMonth: m,
          futuresRef: rows[m].futuresRef || null,
          quantityBu: bu,
          basisPerBu:
            (config.tradeType === "BASIS" || config.tradeType === "ALL_IN") && !isNaN(basisVal)
              ? basisVal
              : null,
          boardPricePerBu:
            config.tradeType === "ALL_IN" && !isNaN(boardVal) ? boardVal : null,
          freightPerMt: !isNaN(freightVal) ? freightVal : null,
          currency: config.currency,
          contractDate: config.contractDate || null,
          notes: rows[m].notes || null,
          tradeType: config.tradeType,
        };
      });

    if (lines.length === 0) { toast("Enter volume for at least one month", "error"); return; }

    setSubmitting(true);
    try {
      await api.post("/api/v1/corn/contracts/bulk", lines);
      toast(`${lines.length} contract${lines.length !== 1 ? "s" : ""} created`, "success");
      onSaved();
    } catch (err: unknown) {
      toast((err as Error).message ?? "Bulk save failed", "error");
    } finally {
      setSubmitting(false);
    }
  }

  const showBasis = config.tradeType === "BASIS" || config.tradeType === "ALL_IN";
  const showBoard = config.tradeType === "ALL_IN";

  return (
    <form onSubmit={handleSubmit} className="bg-surface border border-b-default rounded-lg p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-secondary">New Contracts</h2>
        <button type="button" onClick={onCancel} className="text-faint hover:text-secondary transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Config Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        <div className="space-y-1">
          <label className="text-xs text-muted">Site</label>
          <select value={config.siteCode} onChange={(e) => setConfig((c) => ({ ...c, siteCode: e.target.value }))} required
            className="w-full bg-input-bg border border-b-input text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-focus">
            <option value="">&mdash; Select &mdash;</option>
            {sites.map((s) => <option key={s.code} value={s.code}>{s.name} ({s.code})</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted">Supplier</label>
          <select value={config.supplierName} onChange={(e) => setConfig((c) => ({ ...c, supplierName: e.target.value }))}
            className="w-full bg-input-bg border border-b-input text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-focus">
            <option value="">&mdash; Select &mdash;</option>
            {suppliers.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted">Trade Type</label>
          <div className="flex gap-1 p-0.5 bg-input-bg border border-b-input rounded-lg">
            {(["INDEX", "BASIS", "ALL_IN"] as const).map((t) => (
              <button key={t} type="button" onClick={() => setConfig((c) => ({ ...c, tradeType: t }))}
                className={`flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  config.tradeType === t
                    ? t === "INDEX" ? "bg-warning text-white" : t === "BASIS" ? "bg-action text-white" : "bg-profit text-white"
                    : "text-muted hover:text-secondary"
                }`}>{t === "ALL_IN" ? "ALL-IN" : t}</button>
            ))}
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted">Currency</label>
          <select value={config.currency} onChange={(e) => setConfig((c) => ({ ...c, currency: e.target.value }))}
            className="w-full bg-input-bg border border-b-input text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-focus">
            <option>USD</option>
            <option>CAD</option>
          </select>
        </div>
      </div>

      {/* Month range + contract date */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        <div className="space-y-1">
          <label className="text-xs text-muted">{isAllIn ? "Delivery Month" : "Start Month"}</label>
          <input type="month" value={config.startMonth}
            onChange={(e) => setConfig((c) => ({ ...c, startMonth: e.target.value }))}
            className="w-full bg-input-bg border border-b-input text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-focus" />
        </div>
        {!isAllIn && (
          <div className="space-y-1">
            <label className="text-xs text-muted">End Month</label>
            <input type="month" value={config.endMonth}
              onChange={(e) => setConfig((c) => ({ ...c, endMonth: e.target.value }))}
              className="w-full bg-input-bg border border-b-input text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-focus" />
          </div>
        )}
        <div className="space-y-1">
          <label className="text-xs text-muted">Contract Date</label>
          <input type="date" value={config.contractDate}
            onChange={(e) => setConfig((c) => ({ ...c, contractDate: e.target.value }))}
            className="w-full bg-input-bg border border-b-input text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-focus" />
        </div>
      </div>

      {/* Shared Pricing Fields */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {showBasis && (
          <div className="space-y-1">
            <label className="text-xs text-muted">Basis ($/bu)</label>
            <input type="number" step="0.0025" placeholder="e.g. -0.25" value={pricing.basisBu}
              onChange={(e) => setPricing((p) => ({ ...p, basisBu: e.target.value }))}
              className="w-full bg-input-bg border border-b-input text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-focus placeholder:text-ph" />
          </div>
        )}
        <div className="space-y-1">
          <label className="text-xs text-muted">Freight ($/MT)</label>
          <input type="number" step="0.01" min="0" placeholder="Optional" value={pricing.freightPerMt}
            onChange={(e) => setPricing((p) => ({ ...p, freightPerMt: e.target.value }))}
            className="w-full bg-input-bg border border-b-input text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-focus placeholder:text-ph" />
        </div>
        {showBoard && (
          <div className="space-y-1">
            <label className="text-xs text-muted">Board Price ($/bu)</label>
            <input type="number" step="0.0025" placeholder="e.g. 4.55" value={pricing.boardPriceBu}
              onChange={(e) => setPricing((p) => ({ ...p, boardPriceBu: e.target.value }))}
              className="w-full bg-input-bg border border-b-input text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-focus placeholder:text-ph" />
          </div>
        )}
      </div>

      {/* Default Volume */}
      <div className="rounded-lg bg-tbl-header border border-b-input/50 px-4 py-3 space-y-1">
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted whitespace-nowrap">Default volume:</label>
          <input type="number" placeholder="bushels" step="1" min="0" value={defaultVolume}
            className="w-32 bg-input-bg border border-b-input text-primary rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-focus placeholder:text-ph"
            onChange={(e) => applyAll(e.target.value)} />
          <span className="text-xs text-ph">bu/month</span>
        </div>
        <p className="text-xs text-ph">Sets all months &mdash; override individually below</p>
      </div>

      {/* Monthly Grid */}
      {months.length > 0 ? (
        <div className="rounded-lg border border-b-input overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-input-bg/60 border-b border-b-input">
                <th className="px-3 py-2 text-left text-xs text-muted font-medium w-20">Month</th>
                <th className="px-3 py-2 text-right text-xs text-muted font-medium">Volume (bu)</th>
                <th className="px-3 py-2 text-left text-xs text-muted font-medium w-28">Futures Ref</th>
                <th className="px-3 py-2 text-left text-xs text-muted font-medium">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-b-default">
              {months.map((m) => {
                const row = rows[m] ?? { volume: "", futuresRef: "", notes: "" };
                return (
                  <tr key={m}>
                    <td className="px-3 py-2 font-medium text-secondary whitespace-nowrap">{monthLabel(m)}</td>
                    <td className="px-3 py-1.5">
                      <input type="number" step="1" min="0" placeholder="0" value={row.volume}
                        onChange={(e) => updateRow(m, "volume", e.target.value)}
                        className="w-full bg-transparent text-secondary text-right tabular-nums placeholder:text-ph focus:outline-none" />
                    </td>
                    <td className="px-3 py-1.5">
                      <input type="text" placeholder="e.g. ZCN26" value={row.futuresRef}
                        onChange={(e) => updateRow(m, "futuresRef", e.target.value)}
                        className="w-full bg-transparent text-muted placeholder:text-ph focus:outline-none text-xs" />
                    </td>
                    <td className="px-3 py-1.5">
                      <input type="text" placeholder="Optional" value={row.notes}
                        onChange={(e) => updateRow(m, "notes", e.target.value)}
                        className="w-full bg-transparent text-faint placeholder:text-ph focus:outline-none text-xs" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {months.length > 1 && (
              <tfoot>
                <tr className="bg-input-bg/50 border-t border-b-input">
                  <td className="px-3 py-2 text-xs text-faint font-medium">Total</td>
                  <td className="px-3 py-2 text-right tabular-nums font-bold text-secondary text-sm">
                    {totalBu > 0
                      ? totalBu.toLocaleString("en-US", { maximumFractionDigits: 0 })
                      : "\u2014"}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      ) : (
        <p className="text-sm text-ph italic">Select a valid month range to populate the grid.</p>
      )}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className={btnCancel}>Cancel</button>
        <button type="submit" disabled={submitting || months.length === 0}
          className={btnPrimary}>
          {submitting ? "Saving\u2026" : `Create ${filledCount} Contract${filledCount !== 1 ? "s" : ""}`}
        </button>
      </div>
    </form>
  );
}
