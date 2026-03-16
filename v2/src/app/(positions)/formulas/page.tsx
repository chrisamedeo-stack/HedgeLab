"use client";

import { useState, useEffect } from "react";
import { Plus, Edit2, Trash2 } from "lucide-react";
import { API_BASE } from "@/lib/api";
import { Modal } from "@/components/ui/Modal";
import { FormulaCard } from "@/components/pricing/FormulaCard";
import { FormulaBuilder } from "@/components/pricing/FormulaBuilder";
import { TemplateSelector } from "@/components/pricing/TemplateSelector";
import { RateTableEditor } from "@/components/pricing/RateTableEditor";
import { FormulaEvaluator } from "@/components/pricing/FormulaEvaluator";
import { usePricingStore } from "@/store/pricingStore";
import { useOrgContext } from "@/contexts/OrgContext";
import type { FormulaRow, RateTable, FormulaTemplate } from "@/types/pricing";
import type { FormulaComponent } from "@/lib/pricingEngine";

type SubTab = "formulas" | "rate-tables" | "evaluator";

const btnPrimary = "inline-flex items-center gap-2 rounded-lg bg-action px-4 py-2 text-sm font-medium text-white hover:bg-action-hover transition-colors disabled:opacity-50";
const btnCancel = "inline-flex items-center gap-2 rounded-lg bg-input-bg px-4 py-2 text-sm font-medium text-secondary hover:bg-hover transition-colors border border-b-input";
const inputCls = "w-full bg-input-bg border border-b-input text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-focus placeholder:text-ph";

function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(opts?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || body.message || body.error || `Request failed (${res.status})`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export default function FormulasPage() {
  const { orgId, isPluginEnabled } = useOrgContext();
  const formulaEnabled = isPluginEnabled("formula_pricing");

  const [subTab, setSubTab] = useState<SubTab>("formulas");
  const [commodities, setCommodities] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  const {
    formulas, rateTables, templates, loading,
    fetchFormulas, fetchRateTables, fetchTemplates,
    createFormula, updateFormula, deleteFormula, duplicateFormula,
    createRateTable, updateRateTable, deleteRateTable,
    instantiateTemplate,
  } = usePricingStore();

  // Modal state
  const [showFormulaModal, setShowFormulaModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showRateTableModal, setShowRateTableModal] = useState(false);
  const [editingFormula, setEditingFormula] = useState<FormulaRow | null>(null);
  const [editingRateTable, setEditingRateTable] = useState<RateTable | null>(null);
  const [templatePrefill, setTemplatePrefill] = useState<FormulaTemplate | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: "formula" | "rateTable"; id: string; name: string } | null>(null);
  const [evalFormulaId, setEvalFormulaId] = useState<string | undefined>();

  // Load data
  useEffect(() => {
    if (!formulaEnabled) return;
    fetchFormulas(orgId);
    fetchRateTables(orgId);
    fetchTemplates();
    apiFetch("/api/kernel/commodities")
      .then((data: any[]) => setCommodities(data.map((c: any) => ({ id: c.id, name: c.name }))))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formulaEnabled]);

  // Formula CRUD
  async function handleSaveFormula(data: {
    name: string; description: string; commodityId: string | null;
    formulaType: string; components: FormulaComponent[];
    outputUnit: string | null; rounding: number;
  }) {
    setSaving(true);
    try {
      if (editingFormula) {
        await updateFormula(editingFormula.id, data);
      } else {
        await createFormula({ orgId, ...data, description: data.description || undefined, commodityId: data.commodityId ?? undefined, outputUnit: data.outputUnit ?? undefined });
      }
      setShowFormulaModal(false);
      setEditingFormula(null);
      setTemplatePrefill(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function handleEditFormula(f: FormulaRow) {
    setEditingFormula(f);
    setTemplatePrefill(null);
    setShowFormulaModal(true);
  }

  async function handleDuplicateFormula(f: FormulaRow) {
    try {
      await duplicateFormula(f.id, orgId);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  function handleTestFormula(f: FormulaRow) {
    setEvalFormulaId(f.id);
    setSubTab("evaluator");
  }

  function handleDeactivateFormula(f: FormulaRow) {
    setDeleteTarget({ type: "formula", id: f.id, name: f.name });
  }

  // Template instantiation
  async function handleSelectTemplate(t: FormulaTemplate) {
    setShowTemplateModal(false);
    try {
      await instantiateTemplate(t.id, orgId);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  function handleFromTemplatePrefill(t: FormulaTemplate) {
    setShowTemplateModal(false);
    setEditingFormula(null);
    setTemplatePrefill(t);
    setShowFormulaModal(true);
  }

  // Rate table CRUD
  async function handleSaveRateTable(data: {
    name: string; rateType: string; commodityId: string | null;
    rates: Record<string, number>;
    effectiveDate: string | null; expiryDate: string | null;
  }) {
    setSaving(true);
    try {
      if (editingRateTable) {
        await updateRateTable(editingRateTable.id, data);
      } else {
        await createRateTable({ orgId, ...data, commodityId: data.commodityId ?? undefined, effectiveDate: data.effectiveDate ?? undefined, expiryDate: data.expiryDate ?? undefined });
      }
      setShowRateTableModal(false);
      setEditingRateTable(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.type === "formula") {
        await deleteFormula(deleteTarget.id);
      } else {
        await deleteRateTable(deleteTarget.id);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDeleteTarget(null);
    }
  }

  // Build initial data for FormulaBuilder when using template prefill
  const formulaBuilderInitial: FormulaRow | null = editingFormula ?? (templatePrefill ? {
    id: "", org_id: orgId, name: templatePrefill.name,
    description: templatePrefill.description, commodity_id: null,
    formula_type: templatePrefill.formulaType,
    components: templatePrefill.components,
    output_unit: templatePrefill.outputUnit, rounding: 4,
    is_active: true, is_system: false, created_at: "", updated_at: "",
  } : null);

  const subTabs: { key: SubTab; label: string }[] = [
    { key: "formulas", label: "Formulas" },
    { key: "rate-tables", label: "Rate Tables" },
    { key: "evaluator", label: "Evaluator" },
  ];

  if (!formulaEnabled) {
    return (
      <div className="space-y-6 page-fade">
        <div>
          <h1 className="text-sm font-semibold text-muted uppercase tracking-wider">Formula Pricing</h1>
          <p className="mt-0.5 text-xs text-faint">Formula pricing plugin is not enabled for this organization.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 page-fade">
      <div>
        <h1 className="text-sm font-semibold text-muted uppercase tracking-wider">Formula Pricing</h1>
        <p className="mt-0.5 text-xs text-faint">Manage pricing formulas, rate tables, and evaluate pricing models</p>
      </div>

      {error && (
        <div className="p-3 bg-loss/10 border border-loss/20 rounded-lg text-sm text-loss">
          {error} <button onClick={() => setError(null)} className="ml-2 underline">dismiss</button>
        </div>
      )}

      {/* Sub-tabs */}
      <div className="inline-flex gap-1 rounded-lg bg-input-bg p-1">
        {subTabs.map((st) => (
          <button key={st.key} onClick={() => setSubTab(st.key)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              subTab === st.key ? "bg-surface text-secondary shadow-sm" : "text-muted hover:text-secondary"
            }`}>
            {st.label}
          </button>
        ))}
      </div>

      {/* Formulas sub-tab */}
      {subTab === "formulas" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted">{formulas.length} formulas</p>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowTemplateModal(true)} className={btnCancel}>
                From Template
              </button>
              <button onClick={() => { setEditingFormula(null); setTemplatePrefill(null); setShowFormulaModal(true); }} className={btnPrimary}>
                <Plus className="h-4 w-4" /> New Formula
              </button>
            </div>
          </div>

          {loading ? <TableSkeleton /> : formulas.length === 0 ? (
            <EmptyState title="No formulas" desc="Create a formula or start from a template."
              onAction={() => setShowTemplateModal(true)} actionLabel="From Template" />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {formulas.map((f) => (
                <FormulaCard key={f.id} formula={f}
                  onEdit={() => handleEditFormula(f)}
                  onDuplicate={() => handleDuplicateFormula(f)}
                  onTest={() => handleTestFormula(f)}
                  onDeactivate={() => handleDeactivateFormula(f)} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Rate Tables sub-tab */}
      {subTab === "rate-tables" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted">{rateTables.length} rate tables</p>
            <button onClick={() => { setEditingRateTable(null); setShowRateTableModal(true); }} className={btnPrimary}>
              <Plus className="h-4 w-4" /> New Rate Table
            </button>
          </div>

          {loading ? <TableSkeleton /> : rateTables.length === 0 ? (
            <EmptyState title="No rate tables" desc="Create rate tables for lookups in pricing formulas."
              onAction={() => setShowRateTableModal(true)} actionLabel="New Rate Table" />
          ) : (
            <div className="bg-surface border border-b-default rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-input-bg/50 border-b border-b-default">
                    {["Name", "Type", "Commodity", "Rates", "Effective", "Expiry", ""].map((h) => (
                      <th key={h} className="text-left px-3 py-3 text-xs font-medium text-muted uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-b-default">
                  {rateTables.map((t) => (
                    <tr key={t.id} className="hover:bg-row-hover transition-colors">
                      <td className="px-3 py-3 font-medium text-secondary">{t.name}</td>
                      <td className="px-3 py-3 text-muted">{t.rate_type}</td>
                      <td className="px-3 py-3 text-muted">{t.commodity_id ?? "All"}</td>
                      <td className="px-3 py-3 text-muted font-mono text-xs">{Object.keys(t.rates).length} entries</td>
                      <td className="px-3 py-3 text-muted text-xs">{t.effective_date ?? "\u2014"}</td>
                      <td className="px-3 py-3 text-muted text-xs">{t.expiry_date ?? "\u2014"}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2 justify-end">
                          <button onClick={() => { setEditingRateTable(t); setShowRateTableModal(true); }}
                            className="text-ph hover:text-action transition-colors" title="Edit">
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => setDeleteTarget({ type: "rateTable", id: t.id, name: t.name })}
                            className="text-ph hover:text-destructive transition-colors" title="Delete">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Evaluator sub-tab */}
      {subTab === "evaluator" && (
        <FormulaEvaluator formulas={formulas} />
      )}

      {/* Formula Builder Modal */}
      <Modal open={showFormulaModal} onClose={() => { setShowFormulaModal(false); setEditingFormula(null); setTemplatePrefill(null); }}
        title={editingFormula ? "Edit Formula" : templatePrefill ? `New Formula (from ${templatePrefill.name})` : "New Formula"}
        width="max-w-3xl">
        <FormulaBuilder
          initial={formulaBuilderInitial}
          rateTables={rateTables}
          commodities={commodities}
          saving={saving}
          onSave={handleSaveFormula}
          onCancel={() => { setShowFormulaModal(false); setEditingFormula(null); setTemplatePrefill(null); }}
        />
      </Modal>

      {/* Template Selector Modal */}
      <Modal open={showTemplateModal} onClose={() => setShowTemplateModal(false)}
        title="Choose a Template" width="max-w-2xl">
        <div className="space-y-3">
          <p className="text-xs text-muted">Select a template to pre-fill a new formula, or click to create instantly.</p>
          <TemplateSelector templates={templates} onSelect={handleFromTemplatePrefill} />
        </div>
      </Modal>

      {/* Rate Table Editor Modal */}
      <Modal open={showRateTableModal} onClose={() => { setShowRateTableModal(false); setEditingRateTable(null); }}
        title={editingRateTable ? "Edit Rate Table" : "New Rate Table"} width="max-w-2xl">
        <RateTableEditor
          initial={editingRateTable}
          commodities={commodities}
          saving={saving}
          onSave={handleSaveRateTable}
          onCancel={() => { setShowRateTableModal(false); setEditingRateTable(null); }}
        />
      </Modal>

      {/* Confirm Delete */}
      {deleteTarget && (
        <ConfirmDialog
          title={`Deactivate ${deleteTarget.type === "formula" ? "Formula" : "Rate Table"}`}
          desc={`Deactivate "${deleteTarget.name}"? It will no longer appear in lists.`}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

// ─── Shared UI ───────────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div className="bg-surface border border-b-default rounded-lg overflow-hidden animate-pulse">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex gap-4 px-4 py-4 border-b border-b-default last:border-0">
          <div className="h-4 bg-hover rounded w-20" /><div className="h-4 bg-hover rounded w-40" /><div className="h-4 bg-hover rounded w-24" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ title, desc, onAction, actionLabel }: { title: string; desc: string; onAction?: () => void; actionLabel?: string }) {
  return (
    <div className="bg-surface border border-b-default rounded-lg p-12 text-center">
      <p className="text-sm font-medium text-secondary">{title}</p>
      <p className="text-xs text-faint mt-1">{desc}</p>
      {onAction && actionLabel && (
        <button onClick={onAction} className={cn(btnPrimary, "mt-4")}><Plus className="h-4 w-4" /> {actionLabel}</button>
      )}
    </div>
  );
}

function ConfirmDialog({ title, desc, onConfirm, onCancel }: { title: string; desc: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-surface border border-b-default rounded-lg p-6 max-w-md w-full mx-4 space-y-4">
        <h3 className="text-sm font-semibold text-secondary">{title}</h3>
        <p className="text-sm text-muted">{desc}</p>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className={btnCancel}>Cancel</button>
          <button onClick={onConfirm} className="inline-flex items-center gap-2 rounded-lg bg-loss px-4 py-2 text-sm font-medium text-white hover:bg-loss/80 transition-colors">Confirm</button>
        </div>
      </div>
    </div>
  );
}
