"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * Admin sign-in — a standalone email+password gate for /admin, separate from
 * the consumer Google flow. Lives OUTSIDE the (panel) route group so it renders
 * bare, with no email gate (it IS the gate).
 */
function AdminLoginContent() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // The panel layout bounces an outdated session here with ?error=email.
  const staleEmail = params.get("error") === "email";

  useEffect(() => {
    // Admin sign-out routes through here so one place clears the cookie.
    if (params.get("logout") === "true") {
      fetch("/api/admin/auth", { method: "DELETE" }).then(() => {
        window.history.replaceState({}, "", "/admin/login");
      });
    }
  }, [params]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) {
        router.push("/admin");
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Invalid email or password");
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-5">
      <div className="w-full max-w-sm">
        <div className="bg-card border border-hairline rounded-2xl p-8">
          <div className="flex flex-col items-center mb-6 text-center">
            <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mb-4">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="text-accent" aria-hidden>
                <path
                  d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
                <path d="M9.5 12l1.8 1.8L15 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h1 className="text-lg font-bold text-foreground">Admin access</h1>
            <p className="text-xs text-muted mt-1">
              Sign in with an authorized admin email and the admin password.
            </p>
          </div>

          {staleEmail && (
            <div className="mb-4 text-xs text-warn bg-warn/10 border border-warn/20 rounded-lg px-3 py-2">
              That email isn’t an authorized admin anymore. Sign in with an admin email and the
              password.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="email"
              placeholder="Admin email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              autoFocus
              className="w-full bg-background border border-hairline rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
            <input
              type="password"
              placeholder="Admin password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="w-full bg-background border border-hairline rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/40"
            />

            {error && (
              <div className="text-sm text-loss bg-loss/10 border border-loss/20 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full bg-accent text-black rounded-lg py-2.5 text-sm font-semibold hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>
        <p className="mt-5 text-center text-[10px] text-muted/60">
          Restricted area — activity here is scoped to app administrators.
        </p>
      </div>
    </main>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense
      fallback={<main className="min-h-screen flex items-center justify-center text-muted text-sm">Loading…</main>}
    >
      <AdminLoginContent />
    </Suspense>
  );
}
