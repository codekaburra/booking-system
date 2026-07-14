import Link from "next/link";
import { getAdminSession } from "@/lib/auth/admin";
import { logoutAction } from "./login/actions";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAdminSession();

  return (
    <div className="flex min-h-full flex-col bg-bg">
      {session && (
        <header className="border-b border-border bg-surface">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
            <nav className="flex items-center gap-4 text-sm">
              <Link href="/admin/inbox" className="font-medium text-primary">
                管理後台
              </Link>
              <Link href="/admin/inbox" className="text-text hover:text-primary">
                申請收件匣
              </Link>
              <Link href="/admin/manual" className="text-text hover:text-primary">
                手動約課
              </Link>
              <Link href="/admin/settings" className="text-text hover:text-primary">
                店鋪設定
              </Link>
              <Link href="/admin/clients" className="text-text hover:text-primary">
                客戶
              </Link>
            </nav>
            <div className="flex items-center gap-3 text-xs text-muted">
              <span>{session.email}{session.demo ? " (示範)" : ""}</span>
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="rounded-full border border-border px-3 py-1.5 text-text hover:border-primary hover:text-primary"
                >
                  登出
                </button>
              </form>
            </div>
          </div>
        </header>
      )}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
        {children}
      </main>
    </div>
  );
}
