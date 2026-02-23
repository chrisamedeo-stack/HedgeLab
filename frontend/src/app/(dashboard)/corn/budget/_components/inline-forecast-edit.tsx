"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import { CornBudgetLineResponse } from "@/hooks/useCorn";
import { api } from "@/lib/api";
import { useToast } from "@/contexts/ToastContext";

export function InlineForecastEdit({ line, onSaved, onCancel }: {
  line: CornBudgetLineResponse; onSaved: () => void; onCancel: () => void;
}) {
  const { toast } = useToast();
  const [value, setValue] = useState(String(line.forecastVolumeMt ?? line.budgetVolumeMt ?? ""));
  const [noteText, setNoteText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSave() {
    setSubmitting(true);
    try {
      await api.put(`/api/v1/corn/budget/${line.id}`, {
        forecastVolumeMt: parseFloat(value) || null,
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
        className="w-20 bg-slate-800 border border-slate-600 text-slate-200 text-right tabular-nums rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
      <input type="text" placeholder="Note" value={noteText}
        onChange={(e) => setNoteText(e.target.value)}
        className="w-24 bg-slate-800 border border-slate-700 text-slate-300 rounded px-2 py-1 text-xs focus:outline-none placeholder:text-slate-600" />
      <button onClick={handleSave} disabled={submitting}
        className="text-emerald-400 hover:text-emerald-300 transition-colors"><Check className="h-3.5 w-3.5" /></button>
      <button onClick={onCancel}
        className="text-slate-500 hover:text-slate-300 transition-colors"><X className="h-3.5 w-3.5" /></button>
    </div>
  );
}
