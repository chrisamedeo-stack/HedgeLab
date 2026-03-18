"use client";

import { useState, useMemo } from "react";
import { useScenarios } from "@/hooks/useForecast";
import { useCommodities, useSites } from "@/hooks/usePositions";
import { useCommodityContext } from "@/contexts/CommodityContext";
import { useOrgContext } from "@/contexts/OrgContext";
import { useAuth } from "@/contexts/AuthContext";
import { useForecastStore } from "@/store/forecastStore";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { KPICard } from "@/components/ui/KPICard";
import { Modal } from "@/components/ui/Modal";
import { StressTestChart } from "@/components/charts/StressTestChart";
import { ScenarioComparisonChart } from "@/components/charts/ScenarioComparisonChart";
import type { ScenarioType, FctScenario, FctScenarioResult } from "@/types/forecast";

type Tab = "scenarios" | "stress-test";

const SCENARIO_TYPE_LABELS: Record<ScenarioType, string> = {
  price_move: "Price Move",
  volume_change: "Volume Change",
  what_if: "What-If",
  stress_test: "Stress Test",
};

const STRESS_PRESETS = [
  { label: "Conservative", deltas: [-0.50, -0.25, 0, 0.25, 0.50] },
  { label: "Moderate", deltas: [-1.00, -0.50, -0.25, 0, 0.25, 0.50, 1.00] },
  { label: "Extreme", deltas: [-2.00, -1.50, -1.00, -0.50, 0, 0.50, 1.00, 1.50, 2.00] },
];

export default function ForecastPage() {
  const { orgId } = useOrgContext();
  const { commodityId, commodity } = useCommodityContext();
  const { user } = useAuth();
  const { data: commodities } = useCommodities();
  const { data: sites } = useSites(orgId);
  const { data: scenarios, loading } = useScenarios(orgId);
  const {
    createScenario, runScenario, deleteScenario, cloneScenario,
    fetchScenario, activeScenario, activeResults, running,
  } = useForecastStore();

  const [tab, setTab] = useState<Tab>("scenarios");
  const [showNew, setShowNew] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // New scenario form
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState<ScenarioType>("price_move");
  const [formDesc, setFormDesc] = useState("");
  const [formCommodity, setFormCommodity] = useState(commodityId ?? "");
  const [formSiteId, setFormSiteId] = useState("");
  const [formPriceChange, setFormPriceChange] = useState("0");
  const [formIsPercent, setFormIsPercent] = useState(false);
  const [formVolumeChange, setFormVolumeChange] = useState("0");
  const [formHedgeVol, setFormHedgeVol] = useState("0");
  const [formHedgePrice, setFormHedgePrice] = useState("0");
  const [formFuturesMonth, setFormFuturesMonth] = useState("");
  const [creating, setCreating] = useState(false);

  // Stress test form
  const [stressCommodity, setStressCommodity] = useState(commodityId ?? "");
  const [stressPreset, setStressPreset] = useState(1); // Moderate
  const [customDeltas, setCustomDeltas] = useState("");
  const [stressResults, setStressResults] = useState<FctScenarioResult[]>([]);

  // KPIs
  const completedScenarios = scenarios.filter((s) => s.status === "completed");
  const latestCompleted = completedScenarios[0];
  const totalPnlImpact = useMemo(() => {
    if (!activeResults.length) return null;
    return activeResults.reduce((sum, r) => sum + Number(r.pnl_change ?? 0), 0);
  }, [activeResults]);

  const resetForm = () => {
    setFormName("");
    setFormType("price_move");
    setFormDesc("");
    setFormCommodity(commodityId ?? "");
    setFormSiteId("");
    setFormPriceChange("0");
    setFormIsPercent(false);
    setFormVolumeChange("0");
    setFormHedgeVol("0");
    setFormHedgePrice("0");
    setFormFuturesMonth("");
  };

  const buildAssumptions = () => {
    switch (formType) {
      case "price_move":
        return { priceChange: Number(formPriceChange), isPercent: formIsPercent };
      case "volume_change":
        return { volumeChange: Number(formVolumeChange), isPercent: formIsPercent };
      case "what_if":
        return {
          siteId: formSiteId,
          futuresMonth: formFuturesMonth,
          hedgeVolume: Number(formHedgeVol),
          hedgePrice: Number(formHedgePrice),
        };
      case "stress_test":
        return { priceDeltas: STRESS_PRESETS[stressPreset].deltas };
    }
  };

  const handleCreate = async () => {
    if (!formName || !formCommodity) return;
    setCreating(true);
    try {
      await createScenario({
        orgId,
        userId: user!.id,
        name: formName,
        description: formDesc || undefined,
        scenarioType: formType,
        baseCommodity: formCommodity,
        baseSiteId: formSiteId || undefined,
        assumptions: buildAssumptions(),
      });
      setShowNew(false);
      resetForm();
    } catch {
      // error via store
    } finally {
      setCreating(false);
    }
  };

  const handleRun = async (id: string) => {
    try {
      await runScenario(id, user!.id);
      setExpandedId(id);
    } catch {
      // error via store
    }
  };

  const handleExpand = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    await fetchScenario(id);
    setExpandedId(id);
  };

  const handleStressRun = async () => {
    if (!stressCommodity) return;
    const deltas = customDeltas
      ? customDeltas.split(",").map((s) => Number(s.trim())).filter((n) => !isNaN(n))
      : STRESS_PRESETS[stressPreset].deltas;

    if (deltas.length === 0) return;

    try {
      const scenario = await createScenario({
        orgId,
        userId: user!.id,
        name: `Stress Test · ${commodities?.find((c) => c.id === stressCommodity)?.name ?? stressCommodity}`,
        scenarioType: "stress_test",
        baseCommodity: stressCommodity,
        assumptions: { priceDeltas: deltas },
      });
      await runScenario(scenario.id, user!.id);
      await fetchScenario(scenario.id);
      setStressResults(useForecastStore.getState().activeResults);
    } catch {
      // error via store
    }
  };

  const inputCls = "w-full border border-b-input bg-input-bg rounded-lg px-3 py-1.5 text-sm text-primary focus:outline-none focus:ring-1 focus:ring-focus";

  return (
    <div className="space-y-6 page-fade">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-sm font-semibold text-muted uppercase tracking-wider">Forecasting</h1>
          <p className="mt-0.5 text-xs text-faint">Scenario analysis, sensitivity, and stress testing</p>
        </div>
        {tab === "scenarios" && (
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-action rounded-lg hover:bg-action-hover transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            New Scenario
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setTab("scenarios")}
          className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
            tab === "scenarios" ? "bg-action-10 text-secondary" : "text-muted hover:text-secondary"
          }`}
        >
          Scenarios
        </button>
        <button
          onClick={() => setTab("stress-test")}
          className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
            tab === "stress-test" ? "bg-action-10 text-secondary" : "text-muted hover:text-secondary"
          }`}
        >
          Stress Test
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KPICard
          label="Total Scenarios"
          value={String(scenarios.length)}
          icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" /></svg>}
        />
        <KPICard
          label="Completed"
          value={String(completedScenarios.length)}
          icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
        <KPICard
          label="Latest Type"
          value={latestCompleted ? SCENARIO_TYPE_LABELS[latestCompleted.scenario_type] : "—"}
          icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" /></svg>}
        />
        <KPICard
          label="P&L Impact"
          value={totalPnlImpact !== null ? `$${totalPnlImpact.toLocaleString()}` : "—"}
          trend={totalPnlImpact !== null ? (totalPnlImpact >= 0 ? "up" : "down") : undefined}
          icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" /></svg>}
        />
      </div>

      {/* ─── Scenarios Tab ─────────────────────────────────────────────── */}
      {tab === "scenarios" && (
        <>
          {/* Chart for expanded scenario */}
          {expandedId && activeScenario?.id === expandedId && activeResults.length > 0 && (
            <ScenarioComparisonChart
              data={activeResults}
              metric={activeScenario.scenario_type === "volume_change" ? "coverage" : "pnl"}
            />
          )}

          {/* Scenario table */}
          {loading ? (
            <div className="text-center py-12 text-faint">Loading scenarios...</div>
          ) : scenarios.length === 0 ? (
            <div className="rounded-lg border border-b-default bg-surface px-6 py-12 text-center">
              <p className="text-faint">No scenarios found.</p>
              <p className="text-xs text-ph mt-1">Create a new scenario to get started.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-b-default bg-surface">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-tbl-border bg-tbl-header">
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted">Name</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted">Type</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted">Commodity</th>
                    <th className="px-4 py-2 text-center text-xs font-medium uppercase tracking-wider text-muted">Status</th>
                    <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted">Updated</th>
                    <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {scenarios.map((s) => (
                    <tr
                      key={s.id}
                      className={`border-b border-tbl-border hover:bg-row-hover transition-colors ${
                        expandedId === s.id ? "bg-row-hover" : ""
                      }`}
                    >
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleExpand(s.id)}
                          className="text-secondary hover:text-primary transition-colors text-left"
                        >
                          {s.name}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-muted">{SCENARIO_TYPE_LABELS[s.scenario_type]}</td>
                      <td className="px-4 py-3 text-muted">{s.commodity_name ?? s.base_commodity ?? "—"}</td>
                      <td className="px-4 py-3 text-center">
                        <StatusBadge status={s.status} />
                      </td>
                      <td className="px-4 py-3 text-right text-faint text-xs tabular-nums">
                        {new Date(s.updated_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {(s.status === "draft" || s.status === "failed") && (
                            <button
                              onClick={() => handleRun(s.id)}
                              disabled={running}
                              className="px-2 py-1 text-xs font-medium text-white bg-action rounded hover:bg-action-hover transition-colors disabled:opacity-50"
                            >
                              {running ? "..." : "Run"}
                            </button>
                          )}
                          {s.status === "completed" && (
                            <button
                              onClick={() => handleExpand(s.id)}
                              className="px-2 py-1 text-xs font-medium text-secondary bg-action-10 rounded hover:text-primary transition-colors"
                            >
                              View
                            </button>
                          )}
                          <button
                            onClick={() => cloneScenario(s.id, user!.id)}
                            className="px-2 py-1 text-xs text-muted hover:text-secondary transition-colors"
                          >
                            Clone
                          </button>
                          <button
                            onClick={() => deleteScenario(s.id, user!.id)}
                            className="px-2 py-1 text-xs text-muted hover:text-loss transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Expanded results detail */}
          {expandedId && activeScenario?.id === expandedId && activeResults.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-b-default bg-surface">
              <div className="px-4 py-2 border-b border-tbl-border bg-tbl-header">
                <span className="text-xs font-medium uppercase tracking-wider text-muted">
                  Results &middot; {activeScenario.name}
                </span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-tbl-border">
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted">Site / Label</th>
                    <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted">Current P&L</th>
                    <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted">Projected P&L</th>
                    <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted">P&L Change</th>
                    <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted">Coverage</th>
                    <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted">Volume</th>
                  </tr>
                </thead>
                <tbody>
                  {activeResults.map((r) => (
                    <tr key={r.id} className="border-b border-tbl-border hover:bg-row-hover transition-colors">
                      <td className="px-4 py-2 text-secondary">{r.site_name ?? r.label ?? "—"}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-muted">
                        {r.current_mtm_pnl != null ? `$${Number(r.current_mtm_pnl).toLocaleString()}` : "—"}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-muted">
                        {r.projected_mtm_pnl != null ? `$${Number(r.projected_mtm_pnl).toLocaleString()}` : "—"}
                      </td>
                      <td className={`px-4 py-2 text-right tabular-nums font-medium ${
                        Number(r.pnl_change ?? 0) >= 0 ? "text-profit" : "text-loss"
                      }`}>
                        {r.pnl_change != null ? `$${Number(r.pnl_change).toLocaleString()}` : "—"}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-muted">
                        {r.projected_coverage_pct != null ? `${Number(r.projected_coverage_pct).toFixed(1)}%` : "—"}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-muted">
                        {r.projected_open_volume != null ? Number(r.projected_open_volume).toLocaleString() : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ─── Stress Test Tab ───────────────────────────────────────────── */}
      {tab === "stress-test" && (
        <>
          <div className="rounded-lg border border-b-default bg-surface p-5 space-y-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Quick Stress Test</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-xs text-muted">Commodity</label>
                <select
                  value={stressCommodity}
                  onChange={(e) => setStressCommodity(e.target.value)}
                  className={inputCls}
                >
                  <option value="">Select commodity...</option>
                  {commodities?.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted">Preset</label>
                <div className="flex gap-2">
                  {STRESS_PRESETS.map((p, i) => (
                    <button
                      key={p.label}
                      onClick={() => { setStressPreset(i); setCustomDeltas(""); }}
                      className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                        stressPreset === i && !customDeltas
                          ? "bg-action text-primary"
                          : "bg-input-bg text-muted hover:bg-hover hover:text-secondary"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted">Custom Deltas (comma-sep)</label>
                <input
                  type="text"
                  value={customDeltas}
                  onChange={(e) => setCustomDeltas(e.target.value)}
                  placeholder="-2, -1, 0, 1, 2"
                  className={inputCls}
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button
                onClick={handleStressRun}
                disabled={!stressCommodity || running}
                className="px-4 py-2 text-sm font-medium text-white bg-action rounded-lg hover:bg-action-hover transition-colors disabled:opacity-50"
              >
                {running ? "Running..." : "Run Stress Test"}
              </button>
            </div>
          </div>

          {/* Stress test chart */}
          <StressTestChart data={stressResults} />

          {/* Stress test results table */}
          {stressResults.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-b-default bg-surface">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-tbl-border bg-tbl-header">
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted">Price Delta</th>
                    <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted">Current Price</th>
                    <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted">Projected Price</th>
                    <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted">P&L Change</th>
                    <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted">Volume</th>
                  </tr>
                </thead>
                <tbody>
                  {stressResults.map((r) => (
                    <tr key={r.id} className="border-b border-tbl-border hover:bg-row-hover transition-colors">
                      <td className="px-4 py-2 text-secondary tabular-nums">{r.label}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-muted">
                        {r.current_all_in_price != null ? `$${Number(r.current_all_in_price).toFixed(4)}` : "—"}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-muted">
                        {r.projected_all_in_price != null ? `$${Number(r.projected_all_in_price).toFixed(4)}` : "—"}
                      </td>
                      <td className={`px-4 py-2 text-right tabular-nums font-medium ${
                        Number(r.pnl_change ?? 0) >= 0 ? "text-profit" : "text-loss"
                      }`}>
                        {r.pnl_change != null ? `$${Number(r.pnl_change).toLocaleString()}` : "—"}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-muted">
                        {r.current_open_volume != null ? Number(r.current_open_volume).toLocaleString() : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ─── New Scenario Modal ────────────────────────────────────────── */}
      <Modal open={showNew} onClose={() => { setShowNew(false); resetForm(); }} title="New Scenario">
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs text-muted">Name</label>
            <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)} className={inputCls} placeholder="e.g. Q3 price sensitivity" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted">Type</label>
            <select value={formType} onChange={(e) => setFormType(e.target.value as ScenarioType)} className={inputCls}>
              <option value="price_move">Price Move</option>
              <option value="volume_change">Volume Change</option>
              <option value="what_if">What-If (Simulate Hedge)</option>
              <option value="stress_test">Stress Test</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted">Commodity</label>
            <select value={formCommodity} onChange={(e) => setFormCommodity(e.target.value)} className={inputCls}>
              <option value="">Select commodity...</option>
              {commodities?.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted">Description</label>
            <textarea value={formDesc} onChange={(e) => setFormDesc(e.target.value)} className={`${inputCls} h-12 resize-none`} placeholder="Optional..." />
          </div>

          {/* Dynamic fields by type */}
          {formType === "price_move" && (
            <div className="flex gap-3 items-end">
              <div className="flex-1 space-y-1">
                <label className="text-xs text-muted">Price Change</label>
                <input type="number" step="0.01" value={formPriceChange} onChange={(e) => setFormPriceChange(e.target.value)} className={inputCls} placeholder="e.g. 0.50" />
              </div>
              <label className="flex items-center gap-1.5 pb-1.5 text-xs text-muted cursor-pointer">
                <input type="checkbox" checked={formIsPercent} onChange={(e) => setFormIsPercent(e.target.checked)} className="rounded" />
                Percent
              </label>
            </div>
          )}

          {formType === "volume_change" && (
            <div className="flex gap-3 items-end">
              <div className="flex-1 space-y-1">
                <label className="text-xs text-muted">Volume Change ({commodity?.volume_unit || "MT"})</label>
                <input type="number" step="1" value={formVolumeChange} onChange={(e) => setFormVolumeChange(e.target.value)} className={inputCls} placeholder="e.g. 5000" />
              </div>
              <label className="flex items-center gap-1.5 pb-1.5 text-xs text-muted cursor-pointer">
                <input type="checkbox" checked={formIsPercent} onChange={(e) => setFormIsPercent(e.target.checked)} className="rounded" />
                Percent
              </label>
            </div>
          )}

          {formType === "what_if" && (
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs text-muted">Site</label>
                <select value={formSiteId} onChange={(e) => setFormSiteId(e.target.value)} className={inputCls}>
                  <option value="">Select site...</option>
                  {sites?.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted">Futures Month</label>
                  <input type="month" value={formFuturesMonth} onChange={(e) => setFormFuturesMonth(e.target.value)} className={inputCls} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted">Volume ({commodity?.volume_unit || "MT"})</label>
                  <input type="number" step="1" value={formHedgeVol} onChange={(e) => setFormHedgeVol(e.target.value)} className={inputCls} placeholder="e.g. 5000" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted">Price ($/unit)</label>
                  <input type="number" step="0.01" value={formHedgePrice} onChange={(e) => setFormHedgePrice(e.target.value)} className={inputCls} placeholder="e.g. 4.50" />
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => { setShowNew(false); resetForm(); }} className="px-4 py-2 text-sm text-faint hover:text-secondary transition-colors">Cancel</button>
            <button
              onClick={handleCreate}
              disabled={creating || !formName || !formCommodity}
              className="px-4 py-2 text-sm font-medium text-white bg-action rounded-lg hover:bg-action-hover transition-colors disabled:opacity-50"
            >
              {creating ? "Creating..." : "Create Scenario"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
