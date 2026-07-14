import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth/admin";

const links = [
  { href: "/admin/settings/courses", label: "課程 / 服務", desc: "時長、容量、價格" },
  { href: "/admin/settings/resources", label: "資源管理", desc: "教練/房間、可開課程、每週開放時間" },
  { href: "/admin/settings/overrides", label: "特殊日期", desc: "國定假日、請假、加開" },
  { href: "/admin/clients", label: "客戶管理", desc: "客戶列表與預約紀錄" },
];

export default async function SettingsHubPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  return (
    <div>
      <h1 className="font-serif text-2xl font-medium">店鋪設定</h1>
      <p className="mt-1 text-sm text-muted">管理課程、資源、開放時間與特殊日期。</p>
      <ul className="mt-6 grid gap-4 sm:grid-cols-2">
        {links.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className="block rounded-xl border border-border bg-surface p-5 transition hover:border-primary"
            >
              <span className="font-medium text-text">{l.label}</span>
              <p className="mt-1 text-xs text-muted">{l.desc}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
