"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { usePositionStore } from "@/store/positionStore";
import type { PhysicalDirection, PricingType } from "@/types/positions";

const USER_ID = "00000000-0000-0000-0000-000000000099";

interface PhysicalFormProps {
  orgId: string;
  siteId: string;
  commodities: { id: string; name: string }[];
  onClose: () => void;
  onSuccess: () => void;
}

export function PhysicalForm({ orgId, siteId, commodities, onClose, onSuccess }: PhysicalFormProps) {
  const { createPhysical } = usePositionStore();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    commodityId: "",
    direction: "buy" as PhysicalDirection,
    volume: "",
    price: "",
    pricingType: "fixed" as PricingType,
    basisPrice: "",
    basisMonth: "",
    deliveryMonth: "",
    counterparty: "",
  });

  const set = (key: string, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await createPhysical({
        orgId,
        userId: USER_ID,
        siteId,
        commodityId: form.commodityId,
        direction: form.direction as PhysicalDirection,
        volume: Number(form.volume),
        price: form.price ? Number(form.price) : undefined,
        pricingType: form.pricingType as PricingType,
        basisPrice: form.basisPrice ? Number(form.basisPrice) : undefined,
        basisMonth: form.basisMonth || undefined,
        deliveryMonth: form.deliveryMonth || undefined,
        counterparty: form.counterparty || undefined,
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
    <Modal open onClose={onClose} title="New Physical Position">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-md bg-destructive-10 border border-destructive-15 px-3 py-2 text-sm text-loss">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Commodity *</span>
            <select
              required
              value={form.commodityId}
              onChange={(e) => set("commodityId", e.target.value)}
              className="w-full rounded-md border border-b-input bg-input-bg px-3 py-2 text-sm text-primary focus:border-focus focus:outline-none"
            >
              <option value="">Select...</option>
              {commodities.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Direction *</span>
            <select
              value={form.direction}
              onChange={(e) => set("direction", e.target.value)}
              className="w-full rounded-md border border-b-input bg-input-bg px-3 py-2 text-sm text-primary focus:border-focus focus:outline-none"
            >
              <option value="buy">Buy</option>
              <option value="sell">Sell</option>
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
              value={form.volume}
              onChange={(e) => set("volume", e.target.value)}
              className="w-full rounded-md border border-b-input bg-input-bg px-3 py-2 text-sm text-primary focus:border-focus focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Price</span>
            <input
              type="number"
              step="any"
              value={form.price}
              onChange={(e) => set("price", e.target.value)}
              className="w-full rounded-md border border-b-input bg-input-bg px-3 py-2 text-sm text-primary focus:border-focus focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Pricing Type</span>
            <select
              value={form.pricingType}
              onChange={(e) => set("pricingType", e.target.value)}
              className="w-full rounded-md border border-b-input bg-input-bg px-3 py-2 text-sm text-primary focus:border-focus focus:outline-none"
            >
              <option value="fixed">Fixed</option>
              <option value="basis">Basis</option>
              <option value="formula">Formula</option>
            </select>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Delivery Month</span>
            <input
              type="month"
              value={form.deliveryMonth}
              onChange={(e) => set("deliveryMonth", e.target.value)}
              className="w-full rounded-md border border-b-input bg-input-bg px-3 py-2 text-sm text-primary focus:border-focus focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Counterparty</span>
            <input
              type="text"
              value={form.counterparty}
              onChange={(e) => set("counterparty", e.target.value)}
              className="w-full rounded-md border border-b-input bg-input-bg px-3 py-2 text-sm text-primary focus:border-focus focus:outline-none"
              placeholder="Company name"
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
            {submitting ? "Creating..." : "Create Physical"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
