"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login({ username, password });
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-main bg-[radial-gradient(circle,#1e293b_1px,transparent_1px)] bg-[size:24px_24px]">
      <div className="bg-surface border border-b-default rounded-2xl p-8 w-full max-w-sm shadow-2xl">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex items-center justify-center h-12 w-12 rounded-lg bg-action text-white font-bold text-xl">
            HL
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold text-primary">HedgeLab CTRM</h1>
            <p className="text-sm text-faint mt-0.5">Sign in to your account</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-secondary mb-1.5">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
              className="w-full bg-input-bg border border-b-input rounded-lg px-3 py-2.5 text-sm text-primary placeholder:text-ph focus:outline-none focus:ring-2 focus:ring-focus focus:border-transparent transition-colors"
              placeholder="username"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-secondary mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-input-bg border border-b-input rounded-lg px-3 py-2.5 text-sm text-primary placeholder:text-ph focus:outline-none focus:ring-2 focus:ring-focus focus:border-transparent transition-colors"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="bg-destructive-10 border border-destructive-30 text-destructive rounded-lg px-3 py-2 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-action hover:bg-action-hover text-white rounded-lg py-2.5 text-sm font-medium disabled:opacity-50 transition-colors"
          >
            {loading ? "Signing in\u2026" : "Sign in"}
          </button>
        </form>

        <p className="text-xs text-ph text-center mt-6">
          Default: admin / admin123
        </p>
      </div>
    </div>
  );
}
