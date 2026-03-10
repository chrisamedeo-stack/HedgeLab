"use client";

import { useState, useEffect } from "react";
import { API_BASE } from "@/lib/api";

interface PluginInfo {
  id: string;
  name: string;
  description: string | null;
  depends_on: string[];
  sort_order: number;
  is_enabled: boolean;
}

export function OrgPluginsManager({ orgId }: { orgId: string }) {
  const [plugins, setPlugins] = useState<PluginInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/platform/organizations/${orgId}/plugins`)
      .then((r) => r.json())
      .then(setPlugins)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [orgId]);

  async function toggle(pluginId: string, enabled: boolean) {
    setToggling(pluginId);
    try {
      await fetch(`${API_BASE}/api/platform/organizations/${orgId}/plugins`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pluginId, enabled }),
      });
      setPlugins((prev) =>
        prev.map((p) => (p.id === pluginId ? { ...p, is_enabled: enabled } : p))
      );
    } catch (err) {
      console.error("Failed to toggle plugin:", err);
    } finally {
      setToggling(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 rounded-lg bg-surface border border-b-default animate-pulse" />
        ))}
      </div>
    );
  }

  const enabledIds = new Set(plugins.filter((p) => p.is_enabled).map((p) => p.id));

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        {plugins.filter((p) => p.is_enabled).length} of {plugins.length} plugins enabled
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {plugins.map((plugin) => {
          const deps = (typeof plugin.depends_on === "string"
            ? JSON.parse(plugin.depends_on)
            : plugin.depends_on) as string[];
          const missingDeps = deps.filter((d) => !enabledIds.has(d));
          const hasMissingDeps = missingDeps.length > 0 && !plugin.is_enabled;

          return (
            <div
              key={plugin.id}
              className={`rounded-lg border p-4 transition-colors ${
                plugin.is_enabled
                  ? "border-action/30 bg-action-10"
                  : "border-b-default bg-surface"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-medium text-secondary">{plugin.name}</h4>
                    {plugin.is_enabled && (
                      <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium bg-profit-20 text-profit">
                        Active
                      </span>
                    )}
                  </div>
                  {plugin.description && (
                    <p className="text-xs text-muted mt-1 line-clamp-2">{plugin.description}</p>
                  )}
                  {deps.length > 0 && (
                    <p className="text-[10px] text-faint mt-1">
                      Requires: {deps.join(", ")}
                    </p>
                  )}
                  {hasMissingDeps && (
                    <p className="text-[10px] text-warning mt-0.5">
                      Missing: {missingDeps.join(", ")}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => toggle(plugin.id, !plugin.is_enabled)}
                  disabled={toggling === plugin.id || hasMissingDeps}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ml-3 disabled:opacity-50 ${
                    plugin.is_enabled ? "bg-action" : "bg-input-bg border border-b-input"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                      plugin.is_enabled ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
