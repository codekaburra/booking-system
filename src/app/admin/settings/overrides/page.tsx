import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth/admin";
import { getSettingsDataSource } from "@/lib/data/settings";
import { addDays, taipeiToday } from "@/lib/tz";
import { OverridesEditor } from "./OverridesEditor";

export default async function OverridesSettingsPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  const ds = await getSettingsDataSource();
  const today = taipeiToday();
  const [overrides, resources] = await Promise.all([
    ds.getDateOverrides(today, addDays(today, 365)),
    ds.getAllResources(),
  ]);

  return (
    <div>
      <Link href="/admin/settings" className="text-sm text-muted hover:text-primary">
        ← 設定首頁
      </Link>
      <h1 className="mt-2 font-serif text-2xl font-medium">特殊日期</h1>
      <OverridesEditor overrides={overrides} resources={resources} />
    </div>
  );
}
