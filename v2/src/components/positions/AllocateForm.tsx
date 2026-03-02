"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { usePositionStore } from "@/store/positionStore";

const USER_ID = "00000000-0000-0000-0000-000000000099"; // demo admin

interface AllocateFormProps {
  orgId: string;
  sites: { id: string; name: string; code: string }[];
  commodities: { id: string; name: string }[];
  onClose: () => void;
  onSuccess: () => void;
}

export function AllocateForm({ orgId, sites, commodities, onClose, onSuccess }: AllocateFormProps) {
  const { allocate } = usePositionStore();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    siteId: "",
    commodityId: "",
    allocatedVolume: "",
    budgetMonth: "",
    contractMonth: "",
    tradePrice: "",
    direction: "long" as "long" | "short",
  });

  const set = (key: string, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await allocate({
        orgId,
        userId: USER_ID,
        siteId: form.siteId,
        commodityId: form.commodityId,
        allocatedVolume: Number(form.allocatedVolume),
        budgetMonth: form.budgetMonth || undefined,
        contractMonth: form.contractMonth || undefined,
        tradePrice: form.tradePrice ? Number(form.tradePrice) : undefined,
        direction: form.direction,
        currency: "USD",
      });
      onSuccess();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Allocate to Site">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-md bg-destructive-10 border border-destructive-15 px-3 py-2 text-sm text-loss">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Site *</span>
            <select
              required
              value={form.siteId}
              onChange={(e) => set("siteId", e.target.value)}
              className="w-full rounded-md border border-b-input bg-input-bg px-3 py-2 text-sm text-primary focus:border-focus focus:outline-none"
            >
              <option value="">Select site...</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Commodity *</span>
            <select
              required
              value={form.commodityId}
              onChange={(e) => set("commodityId", e.target.value)}
              className="w-full rounded-md border border-b-input bg-input-bg px-3 py-2 text-sm text-primary focus:border-focus focus:outline-none"
            >
              <option value="">Select commodity...</option>
              {commodities.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Volume *</span>
            <input
              type="number"
              required
              step="any"
              value={form.allocatedVolume}
              onChange={(e) => set("allocatedVolume", e.target.value)}
              className="w-full rounded-md border border-b-input bg-input-bg px-3 py-2 text-sm text-primary focus:border-focus focus:outline-none"
              placeholder="5000"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Direction</span>
            <select
              value={form.direction}
              onChange={(e) => set("direction", e.target.value)}
              className="w-full rounded-md border border-b-input bg-input-bg px-3 py-2 text-sm text-primary focus:border-focus focus:outline-none"
            >
              <option value="long">Long</option>
              <option value="short">Short</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Trade Price</span>
            <input
              type="number"
              step="any"
              value={form.tradePrice}
              onChange={(e) => set("tradePrice", e.target.value)}
              className="w-full rounded-md border border-b-input bg-input-bg px-3 py-2 text-sm text-primary focus:border-focus focus:outline-none"
              placeholder="450.00"
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Contract Month</span>
            <input
              type="text"
              value={form.contractMonth}
              onChange={(e) => set("contractMonth", e.target.value)}
              className="w-full rounded-md border border-b-input bg-input-bg px-3 py-2 text-sm text-primary focus:border-focus focus:outline-none"
              placeholder="Z24"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Budget Month</span>
            <input
              type="month"
              value={form.budgetMonth}
              onChange={(e) => set("budgetMonth", e.target.value)}
              className="w-full rounded-md border border-b-input bg-input-bg px-3 py-2 text-sm text-primary focus:border-focus focus:outline-none"
            />
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-b-input px-4 py-2 text-sm text-secondary transition-colors hover:bg-hover"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-action px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-action-hover disabled:opacity-50"
          >
            {submitting ? "Allocating..." : "Allocate"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
