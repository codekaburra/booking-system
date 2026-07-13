import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth/admin";
import { hasSupabaseEnv } from "@/lib/data";
import { shopConfig } from "@/config/shop.config";
import { demoLoginAction } from "./actions";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: `${shopConfig.name}|管理員登入`,
};

export default async function AdminLoginPage() {
  const session = await getAdminSession();
  if (session) redirect("/admin/inbox");

  const hasEnv = hasSupabaseEnv();

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 py-16">
      <div className="text-center">
        <h1 className="font-serif text-2xl font-medium">管理員登入</h1>
        <p className="mt-1 text-sm text-muted">{shopConfig.name}</p>
      </div>

      {hasEnv ? (
        <LoginForm />
      ) : (
        <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-6 text-center">
          <p className="text-sm text-muted">
            未設定 Supabase,可使用示範後台預覽收件匣與手動約課流程。
          </p>
          <form action={demoLoginAction}>
            <button
              type="submit"
              className="w-full rounded-full bg-primary py-2.5 text-sm font-medium text-surface hover:opacity-90"
            >
              進入示範後台
            </button>
          </form>
        </div>
      )}

      <p className="text-center text-xs text-muted">
        <Link href="/" className="hover:text-primary">
          ← 返回首頁
        </Link>
      </p>
    </div>
  );
}
