"use client";

import Link from "next/link";
import { Activity, FileText, Package } from "lucide-react";

export function QuickActions() {
  const actions = [
    { label: "Book Hedge",    description: "Open a new futures position", href: "/corn/positions", icon: Activity },
    { label: "New Contract",  description: "Create a physical contract",  href: "/corn/contracts", icon: FileText },
    { label: "Log Receipt",   description: "Record a corn delivery",      href: "/corn/receipts",  icon: Package },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {actions.map(({ label, description, href, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-blue-500/30 hover:bg-blue-500/5 transition-colors group"
        >
          <Icon className="h-5 w-5 text-slate-600 group-hover:text-blue-400 transition-colors mb-3" />
          <p className="text-sm font-medium text-slate-200 group-hover:text-blue-300 transition-colors">
            {label}
          </p>
          <p className="text-xs text-slate-500 mt-1">{description}</p>
        </Link>
      ))}
    </div>
  );
}
