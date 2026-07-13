import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";

// This is an auth boundary — never prerender it; run the gate on every request
// with the caller's real cookies.
export const dynamic = "force-dynamic";

/**
 * Gate for the real admin pages. /admin/login lives OUTSIDE this route group, so
 * it renders bare (it is the gate). Every page inside (panel) requires a valid,
 * still-authorized admin session — a LIVE check, so revoking an admin takes
 * effect on the next request. Unauthorized → back to the admin login.
 */
export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  const email = await requireAdmin();
  if (!email) redirect("/admin/login");

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-hairline bg-card px-5 py-3 flex items-center justify-between gap-4 flex-wrap">
        <Link href="/admin" className="flex items-center gap-2 group">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-accent" aria-hidden>
            <path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            <path d="M9.5 12l1.8 1.8L15 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="font-semibold text-sm group-hover:text-accent transition-colors">Scalae Admin</span>
        </Link>
        <nav className="flex items-center gap-1 text-xs">
          <Link href="/admin" className="rounded-lg px-2.5 py-1.5 text-muted hover:text-foreground hover:bg-white/5 transition-colors">
            Accounts
          </Link>
          <Link href="/admin/feedback" className="rounded-lg px-2.5 py-1.5 text-muted hover:text-foreground hover:bg-white/5 transition-colors">
            Feedback
          </Link>
        </nav>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-xs text-muted" title="Signed-in admin">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-gain" aria-hidden>
              <path d="M4 4h16v16H4z" stroke="currentColor" strokeWidth="0" />
              <path d="M4 6l8 6 8-6M4 6h16v12H4V6Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            </svg>
            <span className="text-foreground truncate max-w-[200px]">{email}</span>
          </span>
          <a
            href="/admin/login?logout=true"
            className="flex items-center gap-1.5 text-xs font-medium text-loss/90 hover:text-loss border border-loss/30 hover:border-loss/50 rounded-md px-2.5 py-1 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="M16 17l5-5-5-5M21 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Admin sign out
          </a>
        </div>
      </header>
      {children}
    </div>
  );
}
