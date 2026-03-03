"use client";

import { FileCode2 } from "lucide-react";
import type { FormulaTemplate } from "@/types/pricing";

interface Props {
  templates: FormulaTemplate[];
  onSelect: (template: FormulaTemplate) => void;
}

export function TemplateSelector({ templates, onSelect }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {templates.map((t) => (
        <button
          key={t.id}
          onClick={() => onSelect(t)}
          className="text-left bg-surface border border-b-default rounded-lg p-4 hover:border-action/50 hover:bg-row-hover transition-colors group"
        >
          <div className="flex items-start gap-3">
            <div className="p-2 bg-action-20 rounded-lg shrink-0">
              <FileCode2 className="h-4 w-4 text-action" />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-sm font-semibold text-primary group-hover:text-action transition-colors">
                {t.name}
              </h4>
              <p className="text-xs text-faint mt-0.5">{t.description}</p>
              <div className="flex flex-wrap gap-1 mt-2">
                {t.components.slice(0, 4).map((c) => (
                  <span key={c.id} className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-mono bg-input-bg text-muted">
                    {c.id}
                  </span>
                ))}
                {t.components.length > 4 && (
                  <span className="text-[10px] text-faint">+{t.components.length - 4} more</span>
                )}
              </div>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
