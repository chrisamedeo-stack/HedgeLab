"use client";

import { useState, useMemo } from "react";
import { usePositionStore } from "@/store/positionStore";
import { useAuth } from "@/contexts/AuthContext";
import type { HedgeBookEntry } from "@/types/positions";

interface Props {
  entries: HedgeBookEntry[];
  sites: { id: string; name: string; code: string }[];
  commodities: { id: string; name: string }[];
  orgId: string;
  onAllocated: () => void;
}

interface MonthGroup {
  month: string;
  entries: HedgeBookEntry[];
  totalVolume: number;
  allocatedVolume: number;
  openVolume: number;
}

function fmtVol(v: unknown): string {
  const n = Number(v);
  if (!n) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function fmtPrice(v: unknown): string {
  const n = Number(v);
  if (!n) return "—";
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

export function DeliveryMonthTable({ entries, sites, commodities, orgId, onAllocated }: Props) {
  const { allocate } = usePositionStore();
  const { user } = useAuth();
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);
  const [allocatingId, setAllocatingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Allocation form state
  const [form, setForm] = useState({
    siteId: "",
    budgetMonth: "",
    allocatedVolume: "",
  });

  const grouped = useMemo((): MonthGroup[] => {
    const map = new Map<string, HedgeBookEntry[]>();
    for (const e of entries) {
      const key = e.contract_month ?? "Unassigned";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, items]) => {
        const totalVolume = items.reduce((sum, e) => sum + Number(e.allocated_volume), 0);
        const openVolume = items
          .filter((e) => e.status === "open")
          .reduce((sum, e) => sum + Number(e.allocated_volume), 0);
        return {
          month,
          entries: items,
          totalVolume,
          allocatedVolume: totalVolume - openVolume,
          openVolume,
        };
      });
  }, [entries]);

  const toggleMonth = (month: string) => {
    setExpandedMonth((prev) => (prev === month ? null : month));
    setAllocatingId(null);
  };

  const startAllocate = (entry: HedgeBookEntry) => {
    setAllocatingId(entry.id);
    setForm({
      siteId: entry.site_id ?? "",
      budgetMonth: entry.budget_month ?? "",
      allocatedVolume: String(Number(entry.allocated_volume)),
    });
    setError(null);
  };

  const handleAllocate = async (entry: HedgeBookEntry) => {
    setSubmitting(true);
    setError(null);
    try {
      await allocate({
        orgId,
        userId: user!.id,
        tradeId: entry.trade_id ?? undefined,
        siteId: form.siteId,
        commodityId: entry.commodity_id,
        allocatedVolume: Number(form.allocatedVolume),
        budgetMonth: form.budgetMonth || undefined,
        contractMonth: entry.contract_month ?? undefined,
        tradePrice: entry.trade_price ? Number(entry.trade_price) : undefined,
        direction: entry.direction ?? undefined,
        currency: entry.currency,
      });
      setAllocatingId(null);
      onAllocated();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-lg border border-b-default bg-surface">
      <div className="border-b border-tbl-border px-4 py-3">
        <h2 className="text-sm font-semibold text-secondary">Delivery Month View</h2>
        <p className="text-xs text-faint mt-0.5">Hedges grouped by futures month — expand to allocate</p>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-tbl-border bg-tbl-header">
            <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted">Month</th>
            <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted">Total Vol</th>
            <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted">Allocated</th>
            <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted">Open</th>
            <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted w-20"></th>
          </tr>
        </thead>
        <tbody>
          {grouped.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-3 py-8 text-center text-muted">
                No hedge positions yet.
              </td>
            </tr>
          ) : (
            grouped.map((group) => (
              <MonthGroupRow
                key={group.month}
                group={group}
                isExpanded={expandedMonth === group.month}
                onToggle={() => toggleMonth(group.month)}
                allocatingId={allocatingId}
                onStartAllocate={startAllocate}
                onCancelAllocate={() => setAllocatingId(null)}
                form={form}
                setForm={setForm}
                onSubmitAllocate={handleAllocate}
                submitting={submitting}
                error={error}
                sites={sites}
              />
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function MonthGroupRow({
  group,
  isExpanded,
  onToggle,
  allocatingId,
  onStartAllocate,
  onCancelAllocate,
  form,
  setForm,
  onSubmitAllocate,
  submitting,
  error,
  sites,
}: {
  group: MonthGroup;
  isExpanded: boolean;
  onToggle: () => void;
  allocatingId: string | null;
  onStartAllocate: (entry: HedgeBookEntry) => void;
  onCancelAllocate: () => void;
  form: { siteId: string; budgetMonth: string; allocatedVolume: string };
  setForm: React.Dispatch<React.SetStateAction<{ siteId: string; budgetMonth: string; allocatedVolume: string }>>;
  onSubmitAllocate: (entry: HedgeBookEntry) => void;
  submitting: boolean;
  error: string | null;
  sites: { id: string; name: string; code: string }[];
}) {
  return (
    <>
      {/* Group header row */}
      <tr
        className="border-b border-tbl-border cursor-pointer hover:bg-row-hover transition-colors"
        onClick={onToggle}
      >
        <td className="px-3 py-3 font-medium text-secondary">
          <span className="inline-flex items-center gap-2">
            <svg
              className={`h-3 w-3 text-faint transition-transform ${isExpanded ? "rotate-90" : ""}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            {group.month}
          </span>
        </td>
        <td className="px-3 py-3 text-right tabular-nums">{fmtVol(group.totalVolume)}</td>
        <td className="px-3 py-3 text-right tabular-nums text-profit">{fmtVol(group.allocatedVolume)}</td>
        <td className="px-3 py-3 text-right tabular-nums text-warning">{fmtVol(group.openVolume)}</td>
        <td className="px-3 py-3 text-right">
          <span className="text-xs text-faint">{group.entries.length} pos</span>
        </td>
      </tr>

      {/* Expanded: individual positions */}
      {isExpanded &&
        group.entries.map((entry) => (
          <TradeRow
            key={entry.id}
            entry={entry}
            isAllocating={allocatingId === entry.id}
            onStartAllocate={() => onStartAllocate(entry)}
            onCancelAllocate={onCancelAllocate}
            form={form}
            setForm={setForm}
            onSubmit={() => onSubmitAllocate(entry)}
            submitting={submitting}
            error={error}
            sites={sites}
          />
        ))}
    </>
  );
}

function TradeRow({
  entry,
  isAllocating,
  onStartAllocate,
  onCancelAllocate,
  form,
  setForm,
  onSubmit,
  submitting,
  error,
  sites,
}: {
  entry: HedgeBookEntry;
  isAllocating: boolean;
  onStartAllocate: () => void;
  onCancelAllocate: () => void;
  form: { siteId: string; budgetMonth: string; allocatedVolume: string };
  setForm: React.Dispatch<React.SetStateAction<{ siteId: string; budgetMonth: string; allocatedVolume: string }>>;
  onSubmit: () => void;
  submitting: boolean;
  error: string | null;
  sites: { id: string; name: string; code: string }[];
}) {
  const statusColor =
    entry.status === "open" ? "text-warning" :
    entry.status === "efp_closed" ? "text-profit" :
    entry.status === "offset" ? "text-muted" :
    entry.status === "rolled" ? "text-action" : "text-faint";

  return (
    <>
      <tr className="border-b border-tbl-border bg-surface hover:bg-row-hover">
        <td className="px-3 py-2 pl-10">
          <div className="flex items-center gap-2">
            <span className={`text-xs ${entry.direction === "long" ? "text-profit" : "text-loss"}`}>
              {entry.direction ?? "—"}
            </span>
            <span className="text-xs text-faint">{entry.site_name ?? "Unallocated"}</span>
          </div>
        </td>
        <td className="px-3 py-2 text-right tabular-nums text-xs">{fmtVol(entry.allocated_volume)}</td>
        <td className="px-3 py-2 text-right tabular-nums text-xs">{fmtPrice(entry.trade_price)}</td>
        <td className="px-3 py-2 text-right">
          <span className={`text-xs font-medium ${statusColor}`}>{entry.status}</span>
        </td>
        <td className="px-3 py-2 text-right">
          {entry.status === "open" && (
            <button
              onClick={onStartAllocate}
              className="text-xs text-action hover:text-action-hover transition-colors"
            >
              Allocate
            </button>
          )}
        </td>
      </tr>

      {/* Inline allocate form */}
      {isAllocating && (
        <tr className="border-b border-tbl-border">
          <td colSpan={5} className="px-4 py-3">
            <div className="animate-fade-in rounded-lg border border-b-default bg-surface p-4">
              {error && (
                <div className="mb-3 rounded-md bg-destructive-10 border border-destructive-15 px-3 py-2 text-sm text-loss">
                  {error}
                </div>
              )}
              <div className="grid grid-cols-4 gap-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-muted">Site *</span>
                  <select
                    value={form.siteId}
                    onChange={(e) => setForm((f) => ({ ...f, siteId: e.target.value }))}
                    className="w-full rounded-md border border-b-input bg-input-bg px-3 py-1.5 text-sm text-primary focus:border-focus focus:outline-none"
                  >
                    <option value="">Select site...</option>
                    {sites.map((s) => (
                      <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-muted">Volume *</span>
                  <input
                    type="number"
                    step="any"
                    value={form.allocatedVolume}
                    onChange={(e) => setForm((f) => ({ ...f, allocatedVolume: e.target.value }))}
                    className="w-full rounded-md border border-b-input bg-input-bg px-3 py-1.5 text-sm text-primary focus:border-focus focus:outline-none"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-muted">Budget Month</span>
                  <input
                    type="month"
                    value={form.budgetMonth}
                    onChange={(e) => setForm((f) => ({ ...f, budgetMonth: e.target.value }))}
                    className="w-full rounded-md border border-b-input bg-input-bg px-3 py-1.5 text-sm text-primary focus:border-focus focus:outline-none"
                  />
                </label>
                <div className="flex items-end gap-2">
                  <button
                    onClick={onSubmit}
                    disabled={submitting || !form.siteId || !form.allocatedVolume}
                    className="rounded-lg bg-action px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-action-hover disabled:opacity-50"
                  >
                    {submitting ? "Saving..." : "Confirm"}
                  </button>
                  <button
                    onClick={onCancelAllocate}
                    className="rounded-lg border border-b-input px-3 py-1.5 text-sm text-secondary transition-colors hover:bg-hover"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
