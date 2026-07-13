import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth/admin";
import { getAdminDataSource } from "@/lib/data/admin";
import { hasSupabaseEnv } from "@/lib/data";
import { shopConfig } from "@/config/shop.config";
import { InboxList } from "./InboxList";

export const metadata: Metadata = {
  title: `${shopConfig.name}|申請收件匣`,
};

export default async function AdminInboxPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  const ds = await getAdminDataSource();
  const [pending, approved] = await Promise.all([
    ds.getInbox("pending"),
    ds.getInbox("approved"),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-serif text-xl font-medium">申請收件匣</h1>
        <p className="text-sm text-muted">
          {!hasSupabaseEnv() && "示範模式 · "}
          待確認 {pending.length} 筆 · 已確認 {approved.length} 筆
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted">待確認</h2>
        <InboxList items={pending} mode="pending" />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted">已確認(可取消)</h2>
        <InboxList items={approved} mode="approved" />
      </section>
    </div>
  );
}
