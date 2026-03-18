"use client";

import { useState } from "react";
import { useOrgContext } from "@/contexts/OrgContext";
import { useCommodityContext } from "@/contexts/CommodityContext";
import { useAuth } from "@/contexts/AuthContext";
import { useCommodities } from "@/hooks/usePositions";
import { useRiskSummary, useRiskHistory, usePositionLimits, useExposureByTenor, useExposureByCounterparty, useRiskStore } from "@/hooks/useRisk";
import { KPICard } from "@/components/ui/KPICard";
import { DailyPnlTrendChart } from "@/components/charts/DailyPnlTrendChart";
import { PnlByCommodityChart } from "@/components/charts/PnlByCommodityChart";
import { PositionLimitUsageChart } from "@/components/charts/PositionLimitUsageChart";
import { ExposureByTenorChart } from "@/components/charts/ExposureByTenorChart";
import { CounterpartyExposureChart } from "@/components/charts/CounterpartyExposureChart";
import type { LimitType, CreateLimitParams } from "@/types/risk";

const tabs = [
  { id: "pnl", label: "P&L Overview" },
  { id: "limits", label: "Position Limits" },
  { id: "exposure", label: "Exposure" },
] as const;
type TabId = (typeof tabs)[number]["id"];

export default function RiskPage() {
  const { orgId } = useOrgContext();
  const { commodityId } = useCommodityContext();
  const [activeTab, setActiveTab] = useState<TabId>("pnl");

  return (
    <div className="space-y-6 page-fade">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-sm font-semibold text-muted uppercase tracking-wider">Risk Management</h1>
          <p className="mt-0.5 text-xs text-faint">Mark-to-market, position limits &amp; exposure analysis</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 border-b border-b-default">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? "border-action text-action"
                : "border-transparent text-muted hover:text-secondary"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "pnl" && <PnlTab orgId={orgId} commodityId={commodityId ?? undefined} />}
      {activeTab === "limits" && <LimitsTab orgId={orgId} />}
      {activeTab === "exposure" && <ExposureTab orgId={orgId} commodityId={commodityId ?? undefined} />}
    </div>
  );
}

// ─── P&L Overview Tab ───────────────────────────────────────────────────────

function PnlTab({ orgId, commodityId }: { orgId: string; commodityId?: string }) {
  const { data: summary, loading, refetch: refetchSummary } = useRiskSummary(orgId);
  const { data: history } = useRiskHistory(orgId, 30);
  const { runMtm, loading: mtmLoading } = useRiskStore();
  const { user } = useAuth();

  async function handleRunMtm() {
    await runMtm(orgId, user!.id);
    refetchSummary();
  }

  const totalPnl = summary?.totalPnl ?? 0;
  const realizedPnl = summary?.realizedPnl ?? 0;
  const unrealizedPnl = summary?.unrealizedPnl ?? 0;
  const netPosition = summary?.netPosition ?? 0;

  return (
    <div className="space-y-6">
      {/* Run MTM button */}
      <div className="flex justify-end">
        <button
          onClick={handleRunMtm}
          disabled={mtmLoading}
          className="flex items-center gap-1.5 rounded-lg bg-action px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-action-hover disabled:opacity-50"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {mtmLoading ? "Running..." : "Run MTM"}
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Total MTM"
          value={`$${totalPnl.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          className={totalPnl >= 0 ? "text-profit" : "text-loss"}
        />
        <KPICard
          label="Realized P&L"
          value={`$${realizedPnl.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          className={realizedPnl >= 0 ? "text-profit" : "text-loss"}
        />
        <KPICard
          label="Unrealized P&L"
          value={`$${unrealizedPnl.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          className={unrealizedPnl >= 0 ? "text-profit" : "text-loss"}
        />
        <KPICard
          label="Net Position"
          value={netPosition.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          subtitle={netPosition > 0 ? "Long" : netPosition < 0 ? "Short" : "Flat"}
        />
      </div>

      {/* Daily P&L Trend */}
      <DailyPnlTrendChart data={history} />

      {/* P&L by Commodity */}
      {summary?.byCommodity && summary.byCommodity.length > 0 && (
        <PnlByCommodityChart data={summary.byCommodity} />
      )}

      {loading && !summary && (
        <div className="py-12 text-center text-sm text-faint">Loading risk data...</div>
      )}
    </div>
  );
}

// ─── Position Limits Tab ────────────────────────────────────────────────────

function LimitsTab({ orgId }: { orgId: string }) {
  const { data: limits, loading, refetch } = usePositionLimits(orgId);
  const { data: commodities } = useCommodities();
  const { createLimit, checkLimits, limitChecks, loading: actionLoading } = useRiskStore();
  const { user } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    commodityId: "",
    limitType: "net" as LimitType,
    limitValue: "",
    alertThreshold: "80",
    notes: "",
  });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createLimit({
        orgId,
        userId: user!.id,
        commodityId: form.commodityId || undefined,
        limitType: form.limitType,
        limitValue: Number(form.limitValue),
        alertThreshold: Number(form.alertThreshold),
        notes: form.notes || undefined,
      });
      setShowForm(false);
      setForm({ commodityId: "", limitType: "net", limitValue: "", alertThreshold: "80", notes: "" });
      refetch();
    } catch {
      // error handled by store
    }
  }

  async function handleCheckAll() {
    await checkLimits(orgId, user!.id);
    refetch();
  }

  // Build lookup from latest checks
  const checkByLimit: Record<string, { utilization_pct: number; result: string }> = {};
  for (const check of limitChecks) {
    checkByLimit[check.limit_id] = {
      utilization_pct: Number(check.utilization_pct),
      result: check.result,
    };
  }

  const inputClass =
    "w-full bg-input-bg border border-b-input text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-focus";

  return (
    <div className="space-y-6">
      {/* Actions */}
      <div className="flex justify-end gap-3">
        <button
          onClick={handleCheckAll}
          disabled={actionLoading}
          className="flex items-center gap-1.5 rounded-lg border border-b-input px-4 py-2 text-sm font-medium text-muted hover:bg-input-bg transition-colors disabled:opacity-50"
        >
          {actionLoading ? "Checking..." : "Check All"}
        </button>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 rounded-lg bg-action px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-action-hover"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add Limit
        </button>
      </div>

      {/* Limits Table */}
      {limits.length > 0 ? (
        <div className="bg-surface border border-b-default rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-b-default">
              <tr>
                {["Commodity", "Type", "Limit", "Alert At", "Utilization", "Status"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-faint uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-b-default">
              {limits.map((l) => {
                const check = checkByLimit[l.id];
                const pct = check?.utilization_pct ?? 0;
                const result = check?.result ?? "ok";
                const barColor = result === "breached" ? "bg-loss" : result === "warning" ? "bg-warning" : "bg-profit";
                const badgeStyle = result === "breached" ? "bg-destructive-10 text-loss" : result === "warning" ? "bg-warning-10 text-warning" : "bg-profit-10 text-profit";
                return (
                  <tr key={l.id} className="hover:bg-row-hover">
                    <td className="px-4 py-2.5 text-secondary">{l.commodity_name ?? "All"}</td>
                    <td className="px-4 py-2.5 text-muted uppercase text-xs">{l.limit_type}</td>
                    <td className="px-4 py-2.5 tabular-nums text-secondary">{Number(l.limit_value).toLocaleString()}</td>
                    <td className="px-4 py-2.5 tabular-nums text-muted">{Number(l.alert_threshold)}%</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 rounded-full bg-input-bg overflow-hidden">
                          <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                        </div>
                        <span className="text-xs tabular-nums text-muted">{pct.toFixed(0)}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      {check ? (
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${badgeStyle}`}>
                          {result}
                        </span>
                      ) : (
                        <span className="text-xs text-faint">Not checked</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : !loading && (
        <div className="bg-surface border border-b-default rounded-lg px-6 py-12 text-center">
          <p className="text-sm text-faint">No position limits configured</p>
          <button onClick={() => setShowForm(true)} className="mt-2 text-sm text-action hover:underline">
            Add your first limit
          </button>
        </div>
      )}

      {/* Limit Usage Chart */}
      {limitChecks.length > 0 && (
        <PositionLimitUsageChart limits={limits} checks={limitChecks} />
      )}

      {/* Add Limit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowForm(false)}>
          <div className="w-full max-w-md rounded-lg border border-b-default bg-surface p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-primary mb-4">Add Position Limit</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-faint mb-1">Commodity</label>
                  <select value={form.commodityId} onChange={(e) => setForm({ ...form, commodityId: e.target.value })} className={inputClass}>
                    <option value="">All Commodities</option>
                    {(commodities ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-faint mb-1">Limit Type *</label>
                  <select required value={form.limitType} onChange={(e) => setForm({ ...form, limitType: e.target.value as LimitType })} className={inputClass}>
                    <option value="net">Net</option>
                    <option value="long">Long</option>
                    <option value="short">Short</option>
                    <option value="gross">Gross</option>
                    <option value="concentration">Concentration</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-faint mb-1">Limit Value *</label>
                  <input required type="number" step="any" value={form.limitValue} onChange={(e) => setForm({ ...form, limitValue: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-faint mb-1">Alert Threshold (%)</label>
                  <input type="number" step="1" value={form.alertThreshold} onChange={(e) => setForm({ ...form, alertThreshold: e.target.value })} className={inputClass} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-faint mb-1">Notes</label>
                <input type="text" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={inputClass} />
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-b-input px-4 py-2 text-sm text-muted hover:bg-input-bg transition-colors">
                  Cancel
                </button>
                <button type="submit" className="rounded-lg bg-action px-4 py-2 text-sm font-medium text-white hover:bg-action-hover transition-colors">
                  Create Limit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Exposure Tab ───────────────────────────────────────────────────────────

function ExposureTab({ orgId, commodityId }: { orgId: string; commodityId?: string }) {
  const { data: tenorData } = useExposureByTenor(orgId, commodityId);
  const { data: counterpartyData } = useExposureByCounterparty(orgId);
  const { loading } = useRiskStore();

  const hasData = tenorData.length > 0 || counterpartyData.length > 0;

  if (loading && !hasData) {
    return (
      <div className="flex items-center justify-center py-16">
        <svg className="h-6 w-6 animate-spin text-action" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <span className="ml-2 text-sm text-faint">Loading exposure data...</span>
      </div>
    );
  }

  if (!hasData) {
    return (
      <div className="rounded-lg border border-b-default bg-surface px-6 py-16 text-center">
        <svg className="mx-auto h-8 w-8 text-faint mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
        <p className="text-sm font-medium text-secondary">No exposure data available</p>
        <p className="text-xs text-faint mt-1">Run MTM from the P&L tab to generate exposure analysis</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {tenorData.length > 0 && <ExposureByTenorChart data={tenorData} />}
      {counterpartyData.length > 0 && <CounterpartyExposureChart data={counterpartyData} />}
    </div>
  );
}
