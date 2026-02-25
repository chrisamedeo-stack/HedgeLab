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
    <form onSubmit={handleSubmit} className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-200">New Full Year Contracts</h2>
        <button type="button" onClick={onCancel} className="text-zinc-500 hover:text-zinc-300 transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Config Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="space-y-1">
          <label className="text-xs text-zinc-400">Site</label>
          <select value={config.siteCode} onChange={(e) => setConfig((c) => ({ ...c, siteCode: e.target.value }))} required
            className="w-full bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500">
            <option value="">&mdash; Select &mdash;</option>
            {sites.map((s) => <option key={s.code} value={s.code}>{s.name} ({s.code})</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-zinc-400">Supplier</label>
          <select value={config.supplierName} onChange={(e) => setConfig((c) => ({ ...c, supplierName: e.target.value }))}
            className="w-full bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500">
            <option value="">&mdash; Select &mdash;</option>
            {suppliers.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-zinc-400">Trade Type</label>
          <div className="flex gap-1 p-0.5 bg-zinc-800 border border-zinc-700 rounded-lg">
            {(["INDEX", "BASIS", "ALL_IN"] as const).map((t) => (
              <button key={t} type="button" onClick={() => setConfig((c) => ({ ...c, tradeType: t }))}
                className={`flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  config.tradeType === t
                    ? t === "INDEX" ? "bg-amber-600 text-white" : t === "BASIS" ? "bg-blue-600 text-white" : "bg-emerald-600 text-white"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}>{t === "ALL_IN" ? "ALL-IN" : t}</button>
            ))}
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-zinc-400">Currency</label>
          <select value={config.currency} onChange={(e) => setConfig((c) => ({ ...c, currency: e.target.value }))}
            className="w-full bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500">
            <option>USD</option>
            <option>CAD</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-zinc-400">Fiscal Year</label>
          <select value={config.fiscalYear} onChange={(e) => handleFYChange(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500">
            {availableFiscalYears(fyStartMonth).map((fy) => <option key={fy}>{fy}</option>)}
          </select>
        </div>
      </div>

      {/* Shared Pricing Fields */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {showBasis && (
          <div className="space-y-1">
            <label className="text-xs text-zinc-400">Basis ($/bu)</label>
            <input type="number" step="0.0025" placeholder="e.g. -0.25" value={pricing.basisBu}
              onChange={(e) => setPricing((p) => ({ ...p, basisBu: e.target.value }))}
              className="w-full bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-zinc-500" />
          </div>
        )}
        <div className="space-y-1">
          <label className="text-xs text-zinc-400">Freight ($/MT)</label>
          <input type="number" step="0.01" min="0" placeholder="Optional" value={pricing.freightPerMt}
            onChange={(e) => setPricing((p) => ({ ...p, freightPerMt: e.target.value }))}
            className="w-full bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-zinc-500" />
        </div>
        {showBoard && (
          <div className="space-y-1">
            <label className="text-xs text-zinc-400">Board Price ($/bu)</label>
            <input type="number" step="0.0025" placeholder="e.g. 4.55" value={pricing.boardPriceBu}
              onChange={(e) => setPricing((p) => ({ ...p, boardPriceBu: e.target.value }))}
              className="w-full bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-zinc-500" />
          </div>
        )}
        <div className="space-y-1">
          <label className="text-xs text-zinc-400">Contract Date</label>
          <input type="date" value={pricing.contractDate}
            onChange={(e) => setPricing((p) => ({ ...p, contractDate: e.target.value }))}
            className="w-full bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
        </div>
      </div>

      {/* Default Volume */}
      <div className="rounded-lg bg-zinc-800/40 border border-zinc-700/50 px-4 py-3 space-y-1">
        <div className="flex items-center gap-2">
          <label className="text-xs text-zinc-400 whitespace-nowrap">Default volume:</label>
          <input type="number" placeholder="bushels" step="1" min="0" value={defaultVolume}
            className="w-32 bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-zinc-600"
            onChange={(e) => applyAll(e.target.value)} />
          <span className="text-xs text-zinc-600">bu/month</span>
        </div>
        <p className="text-xs text-zinc-600">Sets all months &mdash; override individually below</p>
      </div>

      {/* Monthly Grid */}
      <div className="rounded-lg border border-zinc-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-zinc-800/60 border-b border-zinc-700">
              <th className="px-3 py-2 text-left text-xs text-zinc-400 font-medium w-20">Month</th>
              <th className="px-3 py-2 text-right text-xs text-zinc-400 font-medium">Volume (bu)</th>
              <th className="px-3 py-2 text-left text-xs text-zinc-400 font-medium w-28">Futures Ref</th>
              <th className="px-3 py-2 text-left text-xs text-zinc-400 font-medium">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {months.map((m) => {
              const row = rows[m] ?? { volume: "", futuresRef: "", notes: "" };
              return (
                <tr key={m} className={m.endsWith("-07") ? "border-t-2 border-blue-500/30" : ""}>
                  <td className="px-3 py-2 font-medium text-zinc-300 whitespace-nowrap">{monthLabel(m)}</td>
                  <td className="px-3 py-1.5">
                    <input type="number" step="1" min="0" placeholder="0" value={row.volume}
                      onChange={(e) => updateRow(m, "volume", e.target.value)}
                      className="w-full bg-transparent text-zinc-200 text-right tabular-nums placeholder:text-zinc-700 focus:outline-none" />
                  </td>
                  <td className="px-3 py-1.5">
                    <input type="text" placeholder="e.g. ZCN26" value={row.futuresRef}
                      onChange={(e) => updateRow(m, "futuresRef", e.target.value)}
                      className="w-full bg-transparent text-zinc-400 placeholder:text-zinc-700 focus:outline-none text-xs" />
                  </td>
                  <td className="px-3 py-1.5">
                    <input type="text" placeholder="Optional" value={row.notes}
                      onChange={(e) => updateRow(m, "notes", e.target.value)}
                      className="w-full bg-transparent text-zinc-500 placeholder:text-zinc-700 focus:outline-none text-xs" />
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-zinc-800/50 border-t border-zinc-700">
              <td className="px-3 py-2 text-xs text-zinc-500 font-medium">Total</td>
              <td className="px-3 py-2 text-right tabular-nums font-bold text-zinc-200 text-sm">
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
        <button type="button" onClick={onCancel} className="px-4 py-2 text-zinc-400 hover:text-zinc-200 text-sm transition-colors">Cancel</button>
        <button type="submit" disabled={submitting}
          className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
          {submitting ? "Saving\u2026" : `Create ${filledCount} Contract${filledCount !== 1 ? "s" : ""}`}
        </button>
      </div>
    </form>
  );
}
