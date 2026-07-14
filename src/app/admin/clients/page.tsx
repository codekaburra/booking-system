import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth/admin";
import { getSettingsDataSource } from "@/lib/data/settings";
import { courses } from "@/lib/data/demo-generator";
import { StatusBadge } from "@/components/StatusBadge";
import { hasSupabaseEnv } from "@/lib/data";

export default async function AdminClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  const { client: clientId } = await searchParams;
  const ds = await getSettingsDataSource();
  const clients = await ds.getAllClients();

  let bookings: Awaited<ReturnType<typeof ds.getClientBookings>> = [];
  let selectedName = "";
  if (clientId) {
    bookings = await ds.getClientBookings(clientId);
    selectedName = clients.find((c) => c.id === clientId)?.name ?? "";
  }

  const courseMap = hasSupabaseEnv()
    ? new Map(
        (await ds.getAllCourses()).map((c) => [c.id, c.name]),
      )
    : new Map(courses.map((c) => [c.id, c.name]));

  return (
    <div>
      <Link href="/admin/settings" className="text-sm text-muted hover:text-primary">
        ← 設定首頁
      </Link>
      <h1 className="mt-2 font-serif text-2xl font-medium">客戶管理</h1>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="text-sm font-medium text-muted">客戶列表</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {clients.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/admin/clients?client=${c.id}`}
                  className={`block rounded-lg border px-3 py-2 text-sm ${
                    clientId === c.id
                      ? "border-primary bg-primary/5"
                      : "border-border bg-surface hover:border-primary"
                  }`}
                >
                  <span className="font-medium">{c.name}</span>
                  <span className="ml-2 text-muted">{c.phone}</span>
                  {c.email && <span className="ml-2 text-xs text-muted">{c.email}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2 className="text-sm font-medium text-muted">
            {selectedName ? `${selectedName} 的預約紀錄` : "選擇客戶查看紀錄"}
          </h2>
          <ul className="mt-3 flex flex-col gap-2">
            {bookings.length === 0 ? (
              <li className="rounded-lg border border-border p-4 text-center text-sm text-muted">
                {clientId ? "尚無預約紀錄" : "請從左側選擇客戶"}
              </li>
            ) : (
              bookings.map((b) => (
                <li
                  key={b.id}
                  className="rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={b.status} />
                    <span className="font-mono text-xs">{b.booking_id}</span>
                  </div>
                  <p className="mt-1">{courseMap.get(b.course_id) ?? "—"}</p>
                  {b.starts_at && (
                    <p className="text-xs text-muted">
                      {new Date(b.starts_at).toLocaleString("zh-TW", {
                        timeZone: "Asia/Taipei",
                        month: "numeric",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: false,
                      })}
                    </p>
                  )}
                </li>
              ))
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}
