import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth/admin";
import { getSettingsDataSource } from "@/lib/data/settings";
import { shopConfig } from "@/config/shop.config";

export default async function ResourcesSettingsPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  const ds = await getSettingsDataSource();
  const resources = await ds.getAllResources();

  return (
    <div>
      <Link href="/admin/settings" className="text-sm text-muted hover:text-primary">
        ← 設定首頁
      </Link>
      <h1 className="mt-2 font-serif text-2xl font-medium">
        {shopConfig.resourceLabels[shopConfig.resourceType]}管理
      </h1>
      <ul className="mt-6 flex flex-col gap-3">
        {resources.map((r) => (
          <li key={r.id}>
            <Link
              href={`/admin/settings/resources/${r.id}`}
              className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3 hover:border-primary"
            >
              <span className="flex items-center gap-2">
                {r.color && (
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: r.color }}
                  />
                )}
                {r.name}
              </span>
              <span className="text-xs text-muted">
                {r.is_active ? "啟用" : "停用"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
