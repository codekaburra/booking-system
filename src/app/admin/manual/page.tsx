import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth/admin";
import { getAdminDataSource } from "@/lib/data/admin";
import { hasSupabaseEnv } from "@/lib/data";
import { shopConfig } from "@/config/shop.config";
import { ManualBookingForm } from "./ManualBookingForm";

export const metadata: Metadata = {
  title: `${shopConfig.name}|手動約課`,
};

export default async function AdminManualPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  const ds = await getAdminDataSource();
  const slots = await ds.getManualSlotOptions();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-serif text-xl font-medium">手動約課</h1>
        <p className="text-sm text-muted">
          電話 / LINE / 現場客戶,直接確認預約
          {!hasSupabaseEnv() && " · 示範模式"}
        </p>
      </div>
      <ManualBookingForm slots={slots} />
    </div>
  );
}
