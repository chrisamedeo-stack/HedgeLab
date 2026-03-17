"use client";

import { useState, useEffect, useCallback } from "react";
import { useOrgContext } from "@/contexts/OrgContext";
import { useHedgeBookStore } from "@/store/hedgeBookStore";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Modal } from "@/components/ui/Modal";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { HedgeBook } from "@/types/positions";

function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export default function HedgeBooksSettingsPage() {
  const { orgId } = useOrgContext();
  const { books, fetchBooks, createBook, updateBook, deactivateBook } = useHedgeBookStore();

  const [showModal, setShowModal] = useState(false);
  const [editingBook, setEditingBook] = useState<HedgeBook | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [displayOrder, setDisplayOrder] = useState(0);

  useEffect(() => {
    if (orgId) fetchBooks(orgId);
  }, [orgId, fetchBooks]);

  const openCreate = useCallback(() => {
    setEditingBook(null);
    setName("");
    setCurrency("USD");
    setDisplayOrder(0);
    setError(null);
    setShowModal(true);
  }, []);

  const openEdit = useCallback((book: HedgeBook) => {
    setEditingBook(book);
    setName(book.name);
    setCurrency(book.currency);
    setDisplayOrder(book.display_order);
    setError(null);
    setShowModal(true);
  }, []);

  const handleSubmit = async () => {
    if (!name.trim()) { setError("Name is required"); return; }
    setSubmitting(true);
    setError(null);
    try {
      if (editingBook) {
        await updateBook(editingBook.id, { name, currency, displayOrder });
      } else {
        await createBook({ orgId, name, currency, displayOrder });
      }
      setShowModal(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivate = async (book: HedgeBook) => {
    if (!confirm(`Deactivate "${book.name}"? This will hide it from the position manager.`)) return;
    try {
      await deactivateBook(book.id);
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const columns: Column<HedgeBook>[] = [
    { key: "name", header: "Name" },
    { key: "currency", header: "Currency", width: "80px" },
    { key: "org_unit_name", header: "Org Unit", render: (r) => r.org_unit_name ?? "Corporate" },
    { key: "commodity_name", header: "Commodity", render: (r) => r.commodity_name ?? "All" },
    {
      key: "is_active",
      header: "Status",
      render: (r) => <StatusBadge status={r.is_active ? "approved" : "cancelled"} />,
    },
    { key: "display_order", header: "Order", align: "right", width: "80px" },
    {
      key: "actions",
      header: "",
      sortable: false,
      align: "right",
      render: (r) => (
        <div className="flex gap-2 justify-end">
          <button onClick={() => openEdit(r)} className="text-xs text-action hover:underline">Edit</button>
          {r.is_active && (
            <button onClick={() => handleDeactivate(r)} className="text-xs text-destructive hover:underline">
              Deactivate
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 page-fade">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-sm font-semibold text-muted uppercase tracking-wider">Hedge Books</h1>
          <p className="mt-0.5 text-xs text-faint">Manage hedge books that group positions for the position manager</p>
        </div>
        <button onClick={openCreate} className="btnPrimary text-sm">
          + New Hedge Book
        </button>
      </div>

      <DataTable columns={columns} data={books} emptyMessage="No hedge books configured" />

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editingBook ? "Edit Hedge Book" : "Create Hedge Book"}>
        <div className="space-y-4">
          {error && <p className="text-sm text-destructive">{error}</p>}

          <div>
            <label className="block text-xs font-medium text-muted mb-1">Name</label>
            <input
              type="text" value={name} onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-b-default bg-input-bg px-3 py-2 text-sm text-primary"
              placeholder="e.g. Canada Grain CAD"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Currency</label>
              <select
                value={currency} onChange={(e) => setCurrency(e.target.value)}
                className="w-full rounded-md border border-b-default bg-input-bg px-3 py-2 text-sm text-primary"
              >
                <option value="USD">USD</option>
                <option value="CAD">CAD</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Display Order</label>
              <input
                type="number" value={displayOrder} onChange={(e) => setDisplayOrder(Number(e.target.value))}
                className="w-full rounded-md border border-b-default bg-input-bg px-3 py-2 text-sm text-primary"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowModal(false)} className="text-sm text-muted hover:text-secondary">
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className={cn("btnPrimary text-sm", submitting && "opacity-50")}
            >
              {submitting ? "Saving..." : editingBook ? "Update" : "Create"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
