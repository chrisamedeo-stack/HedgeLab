"use client";

import { useState, useMemo } from "react";
import { X } from "lucide-react";
import { useSites } from "@/hooks/useCorn";
import { useSuppliers } from "@/hooks/useSettings";
import { api } from "@/lib/api";
import {
  BUSHELS_PER_MT,
  suggestFuturesMonth,
  fiscalYearMonths,
  availableFiscalYears,
  monthLabel,
} from "@/lib/corn-utils";
import { useToast } from "@/contexts/ToastContext";
import { btnPrimary, btnCancel } from "@/lib/corn-format";

export function FiscalYearContractGrid({ onSaved, onCancel, fyStartMonth = 7 }: { onSaved: () => void; onCancel: () => void; fyStartMonth?: number }) {
  const { sites } = useSites();
  const { suppliers } = useSuppliers();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const [config, setConfig] = useState({
    siteCode: "",
    supplierName: "",
    tradeType: "INDEX" as "INDEX" | "BASIS" | "ALL_IN",
    currency: "USD",
    fiscalYear: availableFiscalYears(fyStartMonth)[2],
  });

  const [pricing, setPricing] = useState({
    basisBu: "",
    freightPerMt: "",
    boardPriceBu: "",
    contractDate: new Date().toISOString().slice(0, 10),
  });

  const [defaultVolume, setDefaultVolume] = useState("");

  type MRow = { volume: string; futuresRef: string; notes: string };
  const mkRows = (fy: string) =>
    Object.fromEntries(
      fiscalYearMonths(fy, fyStartMonth).map((m) => [
        m,
        { volume: "", futuresRef: suggestFuturesMonth(m), notes: "" },
      ])
    );
  const [rows, setRows] = useState<Record<string, MRow>>(() => mkRows(config.fiscalYear));

  function handleFYChange(fy: string) {
    setConfig((c) => ({ ...c, fiscalYear: fy }));
    setRows(mkRows(fy));
  }

  function updateRow(m: string, f: keyof MRow, v: string) {
    setRows((r) => ({ ...r, [m]: { ...r[m], [f]: v } }));
  }

  function applyAll(v: string) {
    setDefaultVolume(v);
    setRows((r) =>
      Object.fromEntries(Object.entries(r).map(([m, row]) => [m, { ...row, volume: v }]))
    );
  }

  const months = fiscalYearMonths(config.fiscalYear, fyStartMonth);

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
          contractDate: pricing.contractDate || null,
          notes: rows[m].notes || null,
          tradeType: config.tradeType,
        };
      });

    if (lines.length === 0) { toast("Enter volume for at least one month", "error"); return; }

    setSubmitting(true);
    try {
      await api.post("/api/v1/corn/contracts/bulk", lines);
      toast(`${lines.length} contracts created`, "success");
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
        <h2 className="text-sm font-semibold text-secondary">New Full Year Contracts</h2>
        <button type="button" onClick={onCancel} className="text-faint hover:text-secondary transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Config Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
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
        <div className="space-y-1">
          <label className="text-xs text-muted">Fiscal Year</label>
          <select value={config.fiscalYear} onChange={(e) => handleFYChange(e.target.value)}
            className="w-full bg-input-bg border border-b-input text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-focus">
            {availableFiscalYears(fyStartMonth).map((fy) => <option key={fy}>{fy}</option>)}
          </select>
        </div>
      </div>

      {/* Shared Pricing Fields */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
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
        <div className="space-y-1">
          <label className="text-xs text-muted">Contract Date</label>
          <input type="date" value={pricing.contractDate}
            onChange={(e) => setPricing((p) => ({ ...p, contractDate: e.target.value }))}
            className="w-full bg-input-bg border border-b-input text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-focus" />
        </div>
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
                <tr key={m} className={m.endsWith("-07") ? "border-t-2 border-action-30" : ""}>
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
        </table>
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className={btnCancel}>Cancel</button>
        <button type="submit" disabled={submitting}
          className={btnPrimary}>
          {submitting ? "Saving\u2026" : `Create ${filledCount} Contract${filledCount !== 1 ? "s" : ""}`}
        </button>
      </div>
    </form>
  );
}
