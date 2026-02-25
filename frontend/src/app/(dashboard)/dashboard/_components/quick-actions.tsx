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
          className="bg-surface border border-b-default rounded-lg p-5 hover:border-action-30 hover:bg-action-5 transition-colors group"
        >
          <Icon className="h-5 w-5 text-ph group-hover:text-action transition-colors mb-3" />
          <p className="text-sm font-medium text-secondary group-hover:text-action transition-colors">
            {label}
          </p>
          <p className="text-xs text-faint mt-1">{description}</p>
        </Link>
      ))}
    </div>
  );
}
