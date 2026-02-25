"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import { CornBudgetLineResponse } from "@/hooks/useCorn";
import { api } from "@/lib/api";
import { BUSHELS_PER_MT } from "@/lib/corn-utils";
import { useToast } from "@/contexts/ToastContext";

export function InlineForecastEdit({ line, onSaved, onCancel }: {
  line: CornBudgetLineResponse; onSaved: () => void; onCancel: () => void;
}) {
  const { toast } = useToast();
  const [value, setValue] = useState(String(Math.round((line.forecastVolumeMt ?? line.budgetVolumeMt ?? 0) * BUSHELS_PER_MT)));
  const [noteText, setNoteText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSave() {
    setSubmitting(true);
    try {
      const bu = parseFloat(value) || 0;
      await api.put(`/api/v1/corn/budget/${line.id}`, {
        forecastVolumeMt: bu > 0 ? bu / BUSHELS_PER_MT : null,
        forecastNotes: noteText || null,
      });
      toast("Forecast updated", "success");
      onSaved();
    } catch (err: unknown) {
      toast((err as Error).message ?? "Update failed", "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <input type="number" step="any" min="0" value={value}
        onChange={(e) => setValue(e.target.value)} autoFocus
        className="w-20 bg-input-bg border border-b-input text-secondary text-right tabular-nums rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-action" />
      <input type="text" placeholder="Note" value={noteText}
        onChange={(e) => setNoteText(e.target.value)}
        className="w-24 bg-input-bg border border-b-input text-secondary rounded px-2 py-1 text-xs focus:outline-none placeholder:text-ph" />
      <button onClick={handleSave} disabled={submitting}
        className="text-profit hover:text-profit-hover transition-colors"><Check className="h-3.5 w-3.5" /></button>
      <button onClick={onCancel}
        className="text-faint hover:text-secondary transition-colors"><X className="h-3.5 w-3.5" /></button>
    </div>
  );
}
