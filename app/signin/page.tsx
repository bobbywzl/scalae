import Link from "next/link";
import { authEnabled } from "@/lib/auth";

/**
 * The front door for the B2C app. Server component: reads the error from the
 * query and whether auth is even configured (local mode links straight in).
 */
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const enabled = authEnabled();
  return (
    <main className="min-h-screen flex items-center justify-center px-5">
      <div className="w-full max-w-sm text-center">
        <p className="text-4xl mb-3">⚖️</p>
        <h1 className="text-3xl font-bold tracking-tight">Scalae</h1>
        <p className="text-muted text-sm mt-2 leading-relaxed">
          A daily AI intelligence desk for value investors — signal boards, deep research runs, and
          a paper brokerage, weighed against the business every day.
        </p>

        {error && (
          <p className="mt-5 rounded-xl border border-loss/30 bg-loss/8 px-4 py-2.5 text-xs text-loss">
            {error}
          </p>
        )}

        {enabled ? (
          <a
            href="/api/auth/login"
            className="mt-7 flex items-center justify-center gap-3 rounded-xl bg-white text-black font-semibold text-sm px-4 py-3 hover:bg-white/90 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
              <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.2C12.4 13.6 17.7 9.5 24 9.5z" />
              <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.7 6C44.1 38 46.5 31.8 46.5 24.5z" />
              <path fill="#FBBC05" d="M10.5 28.6a14.5 14.5 0 0 1 0-9.2l-7.9-6.2a24 24 0 0 0 0 21.6l7.9-6.2z" />
              <path fill="#34A853" d="M24 48c6.3 0 11.6-2.1 15.5-5.7l-7.7-6c-2.1 1.4-4.8 2.3-7.8 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.2C6.5 42.6 14.6 48 24 48z" />
            </svg>
            Continue with Google
          </a>
        ) : (
          <div className="mt-7 rounded-xl border border-hairline bg-card px-4 py-3 text-xs text-muted text-left leading-relaxed">
            <p className="font-semibold text-[#c7c7cc]">Running in single-user mode.</p>
            <p className="mt-1">
              Google sign-in isn’t configured — set <code>GOOGLE_CLIENT_ID</code>,{" "}
              <code>GOOGLE_CLIENT_SECRET</code> and <code>SESSION_SECRET</code> to turn this into a
              multi-user app.
            </p>
            <Link href="/" className="mt-2 inline-block text-accent font-medium">
              Continue to your desk →
            </Link>
          </div>
        )}

        <p className="mt-6 text-[10px] text-muted/60">
          Educational research tool — not investment advice. Your desks, notes and paper trades are
          private to your account.
        </p>
      </div>
    </main>
  );
}
