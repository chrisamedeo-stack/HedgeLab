"use client";

import { useSetupStore } from "@/store/setupStore";

const CURRENCIES = ["USD", "CAD", "EUR", "GBP", "AUD"];

export function OrgInfoStep() {
  const { orgName, baseCurrency, adminName, adminEmail, adminPassword, setOrgInfo, setStep } = useSetupStore();

  const isValid = orgName.trim() && adminName.trim() && adminEmail.trim() && baseCurrency && adminPassword.length >= 8;

  function handleNext() {
    if (isValid) setStep(2);
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-secondary">Organization Details</h2>
        <p className="mt-1 text-sm text-muted">
          Set up your organization and administrator account.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-secondary mb-1.5">Organization Name</label>
          <input
            type="text"
            value={orgName}
            onChange={(e) => setOrgInfo({ orgName: e.target.value, baseCurrency, adminName, adminEmail, adminPassword })}
            placeholder="Acme Trading Co."
            className="w-full rounded-lg border border-b-input bg-input-bg px-3 py-2 text-sm text-primary placeholder:text-faint focus:border-action focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-secondary mb-1.5">Base Currency</label>
          <select
            value={baseCurrency}
            onChange={(e) => setOrgInfo({ orgName, baseCurrency: e.target.value, adminName, adminEmail, adminPassword })}
            className="w-full rounded-lg border border-b-input bg-input-bg px-3 py-2 text-sm text-primary focus:border-action focus:outline-none"
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <hr className="border-b-default" />

        <div>
          <label className="block text-sm font-medium text-secondary mb-1.5">Administrator Name</label>
          <input
            type="text"
            value={adminName}
            onChange={(e) => setOrgInfo({ orgName, baseCurrency, adminName: e.target.value, adminEmail, adminPassword })}
            placeholder="Jane Smith"
            className="w-full rounded-lg border border-b-input bg-input-bg px-3 py-2 text-sm text-primary placeholder:text-faint focus:border-action focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-secondary mb-1.5">Administrator Email</label>
          <input
            type="email"
            value={adminEmail}
            onChange={(e) => setOrgInfo({ orgName, baseCurrency, adminName, adminEmail: e.target.value, adminPassword })}
            placeholder="jane@acme.com"
            className="w-full rounded-lg border border-b-input bg-input-bg px-3 py-2 text-sm text-primary placeholder:text-faint focus:border-action focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-secondary mb-1.5">Administrator Password</label>
          <input
            type="password"
            value={adminPassword}
            onChange={(e) => setOrgInfo({ orgName, baseCurrency, adminName, adminEmail, adminPassword: e.target.value })}
            placeholder="Minimum 8 characters"
            className="w-full rounded-lg border border-b-input bg-input-bg px-3 py-2 text-sm text-primary placeholder:text-faint focus:border-action focus:outline-none"
          />
          {adminPassword && adminPassword.length < 8 && (
            <p className="mt-1 text-xs text-loss">Password must be at least 8 characters</p>
          )}
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <button
          onClick={handleNext}
          disabled={!isValid}
          className="rounded-lg bg-action px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-action-hover disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
    </div>
  );
}
