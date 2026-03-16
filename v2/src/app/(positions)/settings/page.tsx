"use client";

import React, { useState } from "react";
import {
  Settings,
  Building2,
  Wheat,
  Calendar,
  Shield,
  Calculator,
  Truck,
} from "lucide-react";

import { OrgSettingsTab } from "@/components/admin/OrgSettingsTab";
import { SitesTab } from "@/components/admin/SitesTab";
import { CommoditiesTab } from "@/components/admin/CommoditiesTab";
import { FiscalYearTab } from "@/components/admin/FiscalYearTab";
import { UsersTab } from "@/components/admin/UsersTab";
import { PricingTab } from "@/components/admin/PricingTab";
import { SuppliersTab } from "@/components/admin/SuppliersTab";

type Tab = "org-settings" | "sites" | "commodities" | "fiscal-year" | "users" | "suppliers" | "pricing";

const TABS: { key: Tab; label: string; icon: typeof Settings }[] = [
  { key: "org-settings", label: "Org Settings", icon: Settings },
  { key: "sites", label: "Sites", icon: Building2 },
  { key: "commodities", label: "Commodities", icon: Wheat },
  { key: "fiscal-year", label: "Fiscal Year", icon: Calendar },
  { key: "users", label: "Users", icon: Shield },
  { key: "suppliers", label: "Suppliers & Counterparties", icon: Truck },
  { key: "pricing", label: "Pricing", icon: Calculator },
];

function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("org-settings");

  return (
    <div className="space-y-6 page-fade">
      <div>
        <h1 className="text-sm font-semibold text-muted uppercase tracking-wider">Settings</h1>
        <p className="mt-0.5 text-xs text-faint">Manage organization settings, sites, commodities, fiscal year, and users</p>
      </div>

      <div className="flex gap-6 border-b border-b-default">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={cn(
              "flex items-center gap-2 pb-3 px-1 text-sm font-medium transition-colors border-b-2 -mb-px",
              tab === key ? "border-action text-action" : "border-transparent text-faint hover:text-secondary"
            )}>
            <Icon className="h-4 w-4" />{label}
          </button>
        ))}
      </div>

      {tab === "org-settings" && <OrgSettingsTab />}
      {tab === "sites" && <SitesTab />}
      {tab === "commodities" && <CommoditiesTab />}
      {tab === "fiscal-year" && <FiscalYearTab />}
      {tab === "users" && <UsersTab />}
      {tab === "suppliers" && <SuppliersTab />}
      {tab === "pricing" && <PricingTab />}
    </div>
  );
}
