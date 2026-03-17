"use client";

import React, { useState, useCallback, useEffect } from "react";
import {
  ChevronRight,
  Globe,
  Plus,
  Pencil,
  Trash2,
  X,
  Check,
  MapPin,
  Truck,
} from "lucide-react";
import { apiFetch, btnPrimary, btnCancel, inputCls, selectCls, cn } from "../shared";
import { CommodityTags } from "./CommodityTags";
import { ConfirmDialog } from "../SharedUI";
import type { OrgTreeNode, SiteRef, HierarchyLevel } from "@/types/org";

// ─── Types ──────────────────────────────────────────────────────────────────

interface Supplier {
  id: string;
  counterparty_id: string;
  counterparty_name: string;
  counterparty_code: string | null;
}

interface Counterparty {
  id: string;
  name: string;
  short_name: string | null;
}

interface Props {
  orgId: string;
  userId: string;
  tree: OrgTreeNode[];
  levels: HierarchyLevel[];
  siteTypes: { id: string; name: string }[];
  commodities: { id: string; name: string }[];
  onTreeChange: () => void;
}

// ─── OrgTreeCard ────────────────────────────────────────────────────────────

export function OrgTreeCard({
  orgId,
  userId,
  tree,
  levels,
  siteTypes,
  commodities,
  onTreeChange,
}: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(tree.map((n) => n.id)));
  const [expandedSites, setExpandedSites] = useState<Set<string>>(new Set());
  const [editingUnit, setEditingUnit] = useState<string | null>(null);
  const [editingSite, setEditingSite] = useState<string | null>(null);
  const [addingChildTo, setAddingChildTo] = useState<string | null>(null);
  const [addingSiteTo, setAddingSiteTo] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    type: "unit" | "site";
    id: string;
    name: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Auto-expand root nodes when tree changes
  useEffect(() => {
    setExpanded((prev) => {
      if (prev.size === 0 && tree.length > 0) {
        return new Set(tree.map((n) => n.id));
      }
      return prev;
    });
  }, [tree]);

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSiteExpand(id: string) {
    setExpandedSites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Get the level for a given depth
  const nonSiteLevels = levels.filter((l) => !l.is_site_level);
  const siteLevel = levels.find((l) => l.is_site_level);

  function getChildLevel(parentDepth: number) {
    return nonSiteLevels.find((l) => l.level_depth === parentDepth + 1);
  }

  function isParentOfSites(depth: number): boolean {
    return !!siteLevel && siteLevel.level_depth === depth + 1;
  }

  // ─── Delete handler ─────────────────────────────────────────────────────

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.type === "unit") {
        await apiFetch(`/api/kernel/org-hierarchy/${deleteTarget.id}`, {
          method: "DELETE",
          body: JSON.stringify({ userId }),
        });
      } else {
        await apiFetch(`/api/kernel/sites/${deleteTarget.id}`, { method: "DELETE" });
      }
      onTreeChange();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDeleteTarget(null);
    }
  }

  return (
    <div className="bg-surface border border-b-default rounded-lg">
      {error && (
        <div className="m-3 p-2 bg-loss/10 border border-loss/20 rounded text-xs text-loss flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-loss hover:text-loss/70">
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {tree.length === 0 ? (
        <p className="text-sm text-faint text-center py-12">
          No organizational units yet. Add a hierarchy level above, then create your first unit.
        </p>
      ) : (
        <div className="py-1">
          {tree.map((node) => (
            <UnitRow
              key={node.id}
              node={node}
              depth={0}
              orgId={orgId}
              userId={userId}
              levels={levels}
              siteTypes={siteTypes}
              commodities={commodities}
              expanded={expanded}
              expandedSites={expandedSites}
              editingUnit={editingUnit}
              editingSite={editingSite}
              addingChildTo={addingChildTo}
              addingSiteTo={addingSiteTo}
              onToggleExpand={toggleExpand}
              onToggleSiteExpand={toggleSiteExpand}
              onSetEditingUnit={setEditingUnit}
              onSetEditingSite={setEditingSite}
              onSetAddingChildTo={setAddingChildTo}
              onSetAddingSiteTo={setAddingSiteTo}
              onDelete={setDeleteTarget}
              onError={setError}
              onTreeChange={onTreeChange}
              getChildLevel={getChildLevel}
              isParentOfSites={isParentOfSites}
            />
          ))}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-2 border-t border-b-default text-[10px] text-faint">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded border border-action/30 bg-action/10" />
          Direct commodity
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded border border-dashed border-action/25" />
          Inherited
        </span>
        <span className="flex items-center gap-1">
          <MapPin className="h-3 w-3 text-futures" />
          Site
        </span>
      </div>

      {deleteTarget && (
        <ConfirmDialog
          title={`Delete ${deleteTarget.type === "unit" ? "Unit" : "Site"}`}
          desc={`Delete "${deleteTarget.name}"? This cannot be undone.`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

// ─── Unit Row ───────────────────────────────────────────────────────────────

interface UnitRowProps {
  node: OrgTreeNode;
  depth: number;
  orgId: string;
  userId: string;
  levels: HierarchyLevel[];
  siteTypes: { id: string; name: string }[];
  commodities: { id: string; name: string }[];
  expanded: Set<string>;
  expandedSites: Set<string>;
  editingUnit: string | null;
  editingSite: string | null;
  addingChildTo: string | null;
  addingSiteTo: string | null;
  onToggleExpand: (id: string) => void;
  onToggleSiteExpand: (id: string) => void;
  onSetEditingUnit: (id: string | null) => void;
  onSetEditingSite: (id: string | null) => void;
  onSetAddingChildTo: (id: string | null) => void;
  onSetAddingSiteTo: (id: string | null) => void;
  onDelete: (target: { type: "unit" | "site"; id: string; name: string }) => void;
  onError: (msg: string) => void;
  onTreeChange: () => void;
  getChildLevel: (depth: number) => HierarchyLevel | undefined;
  isParentOfSites: (depth: number) => boolean;
}

function UnitRow(props: UnitRowProps) {
  const {
    node,
    depth,
    orgId,
    userId,
    siteTypes,
    commodities,
    expanded,
    expandedSites,
    editingUnit,
    editingSite,
    addingChildTo,
    addingSiteTo,
    onToggleExpand,
    onToggleSiteExpand,
    onSetEditingUnit,
    onSetEditingSite,
    onSetAddingChildTo,
    onSetAddingSiteTo,
    onDelete,
    onError,
    onTreeChange,
    getChildLevel,
    isParentOfSites,
  } = props;

  const isExpanded = expanded.has(node.id);
  const childCount = node.children.length + node.sites.length;
  const hasChildren = childCount > 0;
  const childLevel = getChildLevel(node.level_depth);
  const canHaveSites = isParentOfSites(node.level_depth);
  const isEditing = editingUnit === node.id;

  // ─── Inline edit state ──────────────────────────────────────────────────
  const [editName, setEditName] = useState(node.name);
  const [editCode, setEditCode] = useState(node.code ?? "");
  const [saving, setSaving] = useState(false);

  function startEdit() {
    setEditName(node.name);
    setEditCode(node.code ?? "");
    onSetEditingUnit(node.id);
  }

  async function saveEdit() {
    setSaving(true);
    try {
      await apiFetch(`/api/kernel/org-hierarchy/${node.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: editName.trim(),
          code: editCode.trim() || null,
          userId,
        }),
      });
      onSetEditingUnit(null);
      onTreeChange();
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function cancelEdit() {
    onSetEditingUnit(null);
  }

  return (
    <div>
      {/* Unit header row */}
      <div
        className="group flex items-center gap-1.5 py-2 px-3 hover:bg-hover/50 transition-colors"
        style={{ paddingLeft: 12 + depth * 24 }}
      >
        {/* Chevron */}
        <button
          onClick={() => hasChildren && onToggleExpand(node.id)}
          className={cn(
            "shrink-0 transition-transform",
            hasChildren ? "text-faint hover:text-secondary" : "invisible"
          )}
        >
          <ChevronRight
            className={cn("h-3.5 w-3.5 transition-transform", isExpanded && "rotate-90")}
          />
        </button>

        <Globe className="h-3.5 w-3.5 text-action shrink-0" />

        {/* Name + code: inline edit or display */}
        {isEditing ? (
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              className={cn(inputCls, "text-xs py-1 w-36")}
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") saveEdit();
                if (e.key === "Escape") cancelEdit();
              }}
            />
            <input
              type="text"
              className={cn(inputCls, "text-xs py-1 w-16")}
              value={editCode}
              onChange={(e) => setEditCode(e.target.value)}
              placeholder="Code"
              onKeyDown={(e) => {
                if (e.key === "Enter") saveEdit();
                if (e.key === "Escape") cancelEdit();
              }}
            />
            <button
              onClick={saveEdit}
              disabled={saving}
              className="text-gain hover:text-gain/80 transition-colors"
              title="Save"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={cancelEdit}
              className="text-faint hover:text-secondary transition-colors"
              title="Cancel"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <>
            <span className="text-sm font-medium text-secondary truncate">{node.name}</span>
            {node.code && (
              <span className="text-[10px] font-mono text-faint bg-hover px-1 py-0.5 rounded shrink-0">
                {node.code}
              </span>
            )}
          </>
        )}

        {/* Level pill */}
        <span className="text-[10px] text-faint bg-hover/60 px-1.5 py-0.5 rounded shrink-0">
          {node.level_label}
        </span>

        {/* Count badge */}
        {!isExpanded && childCount > 0 && (
          <span className="text-[10px] text-faint shrink-0">({childCount})</span>
        )}

        {/* Commodity tags (compact — inline) */}
        <div className="flex-1 min-w-0" />

        {/* Actions */}
        {!isEditing && (
          <div className="hidden group-hover:flex items-center gap-1 shrink-0">
            {childLevel && (
              <button
                onClick={() => {
                  onSetAddingChildTo(node.id);
                  if (!isExpanded) onToggleExpand(node.id);
                }}
                className="text-[10px] text-faint hover:text-action transition-colors flex items-center gap-0.5 px-1"
                title={`Add ${childLevel.label}`}
              >
                <Plus className="h-3 w-3" />
                {childLevel.label}
              </button>
            )}
            {canHaveSites && (
              <button
                onClick={() => {
                  onSetAddingSiteTo(node.id);
                  if (!isExpanded) onToggleExpand(node.id);
                }}
                className="text-[10px] text-faint hover:text-futures transition-colors flex items-center gap-0.5 px-1"
                title="Add Site"
              >
                <Plus className="h-3 w-3" />
                Site
              </button>
            )}
            <button
              onClick={startEdit}
              className="text-faint hover:text-secondary transition-colors p-0.5"
              title="Edit"
            >
              <Pencil className="h-3 w-3" />
            </button>
            <button
              onClick={() => onDelete({ type: "unit", id: node.id, name: node.name })}
              className="text-faint hover:text-loss transition-colors p-0.5"
              title="Delete"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>

      {/* Add child inline form */}
      {addingChildTo === node.id && childLevel && (
        <AddChildForm
          orgId={orgId}
          userId={userId}
          parentId={node.id}
          level={childLevel}
          depth={depth + 1}
          onDone={() => {
            onSetAddingChildTo(null);
            onTreeChange();
          }}
          onCancel={() => onSetAddingChildTo(null)}
          onError={onError}
        />
      )}

      {/* Expanded children + site table */}
      {isExpanded && (
        <>
          {/* Child units (recursive) */}
          {node.children.map((child) => (
            <UnitRow key={child.id} {...props} node={child} depth={depth + 1} />
          ))}

          {/* Site table */}
          {node.sites.length > 0 && (
            <SiteTable
              sites={node.sites}
              parentUnitId={node.id}
              depth={depth + 1}
              orgId={orgId}
              userId={userId}
              siteTypes={siteTypes}
              commodities={commodities}
              expandedSites={expandedSites}
              editingSite={editingSite}
              onToggleSiteExpand={onToggleSiteExpand}
              onSetEditingSite={onSetEditingSite}
              onDelete={onDelete}
              onError={onError}
              onTreeChange={onTreeChange}
            />
          )}

          {/* Add site inline form */}
          {addingSiteTo === node.id && (
            <AddSiteForm
              orgId={orgId}
              userId={userId}
              parentUnitId={node.id}
              parentUnitName={node.name}
              siteTypes={siteTypes}
              depth={depth + 1}
              onDone={() => {
                onSetAddingSiteTo(null);
                onTreeChange();
              }}
              onCancel={() => onSetAddingSiteTo(null)}
              onError={onError}
            />
          )}
        </>
      )}
    </div>
  );
}

// ─── Add Child Form ─────────────────────────────────────────────────────────

function AddChildForm({
  orgId,
  userId,
  parentId,
  level,
  depth,
  onDone,
  onCancel,
  onError,
}: {
  orgId: string;
  userId: string;
  parentId: string;
  level: HierarchyLevel;
  depth: number;
  onDone: () => void;
  onCancel: () => void;
  onError: (msg: string) => void;
}) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiFetch("/api/kernel/org-hierarchy", {
        method: "POST",
        body: JSON.stringify({
          orgId,
          hierarchyLevelId: level.id,
          parentId,
          name: name.trim(),
          code: code.trim() || null,
          userId,
        }),
      });
      onDone();
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-center gap-2 py-1.5 px-3 bg-action/5"
      style={{ paddingLeft: 12 + depth * 24 + 20 }}
    >
      <Globe className="h-3 w-3 text-action/50 shrink-0" />
      <input
        type="text"
        className={cn(inputCls, "text-xs py-1 w-36")}
        placeholder={`${level.label} name`}
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        autoFocus
      />
      <input
        type="text"
        className={cn(inputCls, "text-xs py-1 w-16")}
        placeholder="Code"
        value={code}
        onChange={(e) => setCode(e.target.value)}
      />
      <button type="submit" disabled={saving} className={cn(btnPrimary, "text-xs py-1 px-2")}>
        {saving ? "..." : "Add"}
      </button>
      <button type="button" onClick={onCancel} className="text-xs text-faint hover:text-secondary">
        Cancel
      </button>
    </form>
  );
}

// ─── Add Site Form ──────────────────────────────────────────────────────────

function AddSiteForm({
  orgId,
  userId,
  parentUnitId,
  parentUnitName,
  siteTypes,
  depth,
  onDone,
  onCancel,
  onError,
}: {
  orgId: string;
  userId: string;
  parentUnitId: string;
  parentUnitName: string;
  siteTypes: { id: string; name: string }[];
  depth: number;
  onDone: () => void;
  onCancel: () => void;
  onError: (msg: string) => void;
}) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [siteTypeId, setSiteTypeId] = useState(siteTypes[0]?.id ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiFetch("/api/kernel/sites", {
        method: "POST",
        body: JSON.stringify({
          orgId,
          code: code.trim(),
          name: name.trim(),
          region: parentUnitName,
          siteTypeId: siteTypeId || null,
          orgUnitId: parentUnitId,
        }),
      });
      onDone();
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-center gap-2 py-1.5 px-3 bg-futures/5"
      style={{ paddingLeft: 12 + depth * 24 + 20 }}
    >
      <MapPin className="h-3 w-3 text-futures/50 shrink-0" />
      <input
        type="text"
        className={cn(inputCls, "text-xs py-1 w-16")}
        placeholder="Code"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        required
        autoFocus
      />
      <input
        type="text"
        className={cn(inputCls, "text-xs py-1 w-36")}
        placeholder="Site name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      <select
        className={cn(selectCls, "text-xs py-1 w-28")}
        value={siteTypeId}
        onChange={(e) => setSiteTypeId(e.target.value)}
      >
        <option value="">Type...</option>
        {siteTypes.map((st) => (
          <option key={st.id} value={st.id}>
            {st.name}
          </option>
        ))}
      </select>
      <button type="submit" disabled={saving} className={cn(btnPrimary, "text-xs py-1 px-2")}>
        {saving ? "..." : "Add"}
      </button>
      <button type="button" onClick={onCancel} className="text-xs text-faint hover:text-secondary">
        Cancel
      </button>
    </form>
  );
}

// ─── Site Table ─────────────────────────────────────────────────────────────

function SiteTable({
  sites,
  parentUnitId,
  depth,
  orgId,
  userId,
  siteTypes,
  commodities,
  expandedSites,
  editingSite,
  onToggleSiteExpand,
  onSetEditingSite,
  onDelete,
  onError,
  onTreeChange,
}: {
  sites: SiteRef[];
  parentUnitId: string;
  depth: number;
  orgId: string;
  userId: string;
  siteTypes: { id: string; name: string }[];
  commodities: { id: string; name: string }[];
  expandedSites: Set<string>;
  editingSite: string | null;
  onToggleSiteExpand: (id: string) => void;
  onSetEditingSite: (id: string | null) => void;
  onDelete: (target: { type: "unit" | "site"; id: string; name: string }) => void;
  onError: (msg: string) => void;
  onTreeChange: () => void;
}) {
  const indent = 12 + depth * 24;

  return (
    <div className="mb-1" style={{ paddingLeft: indent }}>
      {/* Table header */}
      <div className="grid grid-cols-[60px_1fr_80px_1fr_40px] gap-2 px-3 py-1 text-[10px] font-semibold text-faint uppercase tracking-wider">
        <span>Code</span>
        <span>Name</span>
        <span>Region</span>
        <span>Commodities</span>
        <span />
      </div>

      {/* Site rows */}
      {sites.map((site) => (
        <SiteRow
          key={site.id}
          site={site}
          orgId={orgId}
          userId={userId}
          siteTypes={siteTypes}
          commodities={commodities}
          isExpanded={expandedSites.has(site.id)}
          isEditing={editingSite === site.id}
          onToggleExpand={() => onToggleSiteExpand(site.id)}
          onSetEditing={(editing) => onSetEditingSite(editing ? site.id : null)}
          onDelete={() => onDelete({ type: "site", id: site.id, name: site.name })}
          onError={onError}
          onTreeChange={onTreeChange}
        />
      ))}
    </div>
  );
}

// ─── Site Row ───────────────────────────────────────────────────────────────

function SiteRow({
  site,
  orgId,
  userId,
  siteTypes,
  commodities,
  isExpanded,
  isEditing,
  onToggleExpand,
  onSetEditing,
  onDelete,
  onError,
  onTreeChange,
}: {
  site: SiteRef;
  orgId: string;
  userId: string;
  siteTypes: { id: string; name: string }[];
  commodities: { id: string; name: string }[];
  isExpanded: boolean;
  isEditing: boolean;
  onToggleExpand: () => void;
  onSetEditing: (editing: boolean) => void;
  onDelete: () => void;
  onError: (msg: string) => void;
  onTreeChange: () => void;
}) {
  const [fullSite, setFullSite] = useState<Record<string, unknown> | null>(null);
  const [editForm, setEditForm] = useState({ code: "", name: "", region: "" });
  const [saving, setSaving] = useState(false);

  // Fetch full site details when expanded
  useEffect(() => {
    if (isExpanded && !fullSite) {
      apiFetch(`/api/kernel/sites?orgId=${orgId}`)
        .then((sites: Record<string, unknown>[]) => {
          const found = sites.find((s) => s.id === site.id);
          if (found) setFullSite(found);
        })
        .catch(() => {});
    }
  }, [isExpanded, site.id, orgId, fullSite]);

  function startEdit() {
    setEditForm({
      code: site.code ?? "",
      name: site.name ?? "",
      region: (fullSite?.region as string) ?? "",
    });
    onSetEditing(true);
  }

  async function saveEdit() {
    setSaving(true);
    try {
      await apiFetch(`/api/kernel/sites/${site.id}`, {
        method: "PUT",
        body: JSON.stringify({
          orgId,
          code: editForm.code.trim() || null,
          name: editForm.name.trim(),
          region: editForm.region.trim() || null,
        }),
      });
      onSetEditing(false);
      onTreeChange();
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function cancelEdit() {
    onSetEditing(false);
  }

  const region = (fullSite?.region as string) ?? "";

  return (
    <div>
      {/* Main row */}
      <div
        className={cn(
          "group grid grid-cols-[60px_1fr_80px_1fr_40px] gap-2 items-center px-3 py-1.5 rounded-md transition-colors cursor-pointer",
          isExpanded ? "bg-hover/30" : "hover:bg-hover/30"
        )}
        onClick={onToggleExpand}
      >
        {isEditing ? (
          <>
            <input
              type="text"
              className={cn(inputCls, "text-xs py-0.5 font-mono")}
              value={editForm.code}
              onChange={(e) => setEditForm((f) => ({ ...f, code: e.target.value }))}
              onClick={(e) => e.stopPropagation()}
              autoFocus
            />
            <input
              type="text"
              className={cn(inputCls, "text-xs py-0.5")}
              value={editForm.name}
              onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
              onClick={(e) => e.stopPropagation()}
            />
            <input
              type="text"
              className={cn(inputCls, "text-xs py-0.5")}
              value={editForm.region}
              onChange={(e) => setEditForm((f) => ({ ...f, region: e.target.value }))}
              onClick={(e) => e.stopPropagation()}
              placeholder="Region"
            />
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <button onClick={saveEdit} disabled={saving} className="text-gain hover:text-gain/80">
                <Check className="h-3 w-3" />
              </button>
              <button onClick={cancelEdit} className="text-faint hover:text-secondary">
                <X className="h-3 w-3" />
              </button>
            </div>
            <span />
          </>
        ) : (
          <>
            <span className="text-xs font-mono text-muted">{site.code}</span>
            <span className="text-xs text-secondary truncate">{site.name}</span>
            <span className="text-[10px] text-faint">{region}</span>
            <SiteCommodityBadges orgId={orgId} entityId={site.id} />
            <div
              className="hidden group-hover:flex items-center gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={startEdit}
                className="text-faint hover:text-secondary transition-colors"
                title="Edit"
              >
                <Pencil className="h-3 w-3" />
              </button>
              <button
                onClick={onDelete}
                className="text-faint hover:text-loss transition-colors"
                title="Delete"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          </>
        )}
      </div>

      {/* Expanded detail */}
      {isExpanded && !isEditing && (
        <div className="ml-4 mr-2 mb-2 space-y-3 border-l-2 border-futures/20 pl-3 py-2">
          {/* Commodity tags (full with add/remove) */}
          <CommodityTags
            orgId={orgId}
            entityType="site"
            entityId={site.id}
            userId={userId}
            allCommodities={commodities}
            onChanged={onTreeChange}
          />

          {/* Linked suppliers */}
          <SupplierSection
            siteId={site.id}
            orgId={orgId}
            userId={userId}
            onError={onError}
          />
        </div>
      )}
    </div>
  );
}

// ─── Site Commodity Badges (compact, read-only) ─────────────────────────────

function SiteCommodityBadges({
  orgId,
  entityId,
}: {
  orgId: string;
  entityId: string;
}) {
  const [direct, setDirect] = useState<{ commodity_id: string; commodity_name: string }[]>([]);
  const [inherited, setInherited] = useState<{
    commodity_id: string;
    commodity_name: string;
    source_name: string;
  }[]>([]);

  useEffect(() => {
    apiFetch(`/api/kernel/commodity-assignments?entityType=site&entityId=${entityId}`)
      .then((data) => {
        setDirect(data.direct ?? []);
        setInherited(data.inherited ?? []);
      })
      .catch(() => {});
  }, [entityId]);

  if (direct.length === 0 && inherited.length === 0) {
    return <span className="text-[10px] text-faint">—</span>;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {direct.map((d) => (
        <span
          key={d.commodity_id}
          className="px-1.5 py-0 text-[10px] font-medium bg-action/10 text-action border border-action/30 rounded"
        >
          {d.commodity_name}
        </span>
      ))}
      {inherited.map((i) => (
        <span
          key={i.commodity_id}
          className="px-1.5 py-0 text-[10px] font-medium border border-dashed border-action/25 text-action/45 rounded"
          title={`Inherited from ${i.source_name}`}
        >
          {i.commodity_name}
        </span>
      ))}
    </div>
  );
}

// ─── Supplier Section ───────────────────────────────────────────────────────

function SupplierSection({
  siteId,
  orgId,
  userId,
  onError,
}: {
  siteId: string;
  orgId: string;
  userId: string;
  onError: (msg: string) => void;
}) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [allCounterparties, setAllCounterparties] = useState<Counterparty[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  const loadSuppliers = useCallback(async () => {
    try {
      const data = await apiFetch(`/api/kernel/sites/${siteId}/suppliers`);
      setSuppliers(data ?? []);
    } catch {
      // table may not exist yet
      setSuppliers([]);
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  const loadCounterparties = useCallback(async () => {
    try {
      const data = await apiFetch(`/api/contracts/counterparties?orgId=${orgId}`);
      setAllCounterparties(data ?? []);
    } catch {
      // contracts plugin not enabled — that's fine
      setAllCounterparties([]);
    }
  }, [orgId]);

  useEffect(() => {
    loadSuppliers();
    loadCounterparties();
  }, [loadSuppliers, loadCounterparties]);

  async function handleAdd(counterpartyId: string) {
    setAdding(true);
    try {
      await apiFetch(`/api/kernel/sites/${siteId}/suppliers`, {
        method: "POST",
        body: JSON.stringify({ counterpartyId, userId }),
      });
      await loadSuppliers();
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(counterpartyId: string) {
    try {
      await apiFetch(`/api/kernel/sites/${siteId}/suppliers/${counterpartyId}`, {
        method: "DELETE",
        body: JSON.stringify({ userId }),
      });
      await loadSuppliers();
    } catch (err) {
      onError((err as Error).message);
    }
  }

  if (loading) return <div className="h-6 rounded bg-surface animate-pulse" />;

  const linkedIds = new Set(suppliers.map((s) => s.counterparty_id));
  const available = allCounterparties.filter((cp) => !linkedIds.has(cp.id));

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <Truck className="h-3 w-3 text-faint" />
        <h5 className="text-[10px] font-semibold text-faint uppercase tracking-wider">
          Linked Suppliers
        </h5>
      </div>

      {suppliers.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {suppliers.map((s) => (
            <span
              key={s.counterparty_id}
              className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-hover/50 border border-b-default rounded-md text-secondary"
            >
              {s.counterparty_name}
              {s.counterparty_code && (
                <span className="text-[10px] text-faint font-mono">{s.counterparty_code}</span>
              )}
              <button
                onClick={() => handleRemove(s.counterparty_id)}
                className="text-faint hover:text-loss transition-colors"
                title="Remove"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <span className="text-xs text-faint">No suppliers linked</span>
      )}

      {/* Add supplier dropdown */}
      {available.length > 0 && (
        <select
          className={cn(selectCls, "w-auto text-xs")}
          value=""
          onChange={(e) => {
            if (e.target.value) handleAdd(e.target.value);
          }}
          disabled={adding}
        >
          <option value="">+ Add supplier</option>
          {available.map((cp) => (
            <option key={cp.id} value={cp.id}>
              {cp.name}
              {cp.short_name ? ` (${cp.short_name})` : ""}
            </option>
          ))}
        </select>
      )}

      {allCounterparties.length === 0 && suppliers.length === 0 && (
        <span className="text-[10px] text-faint italic">
          Enable the Contracts plugin to manage suppliers
        </span>
      )}
    </div>
  );
}
