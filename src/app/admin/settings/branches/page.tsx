import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth/admin";
import { getSettingsDataSource } from "@/lib/data/settings";
import { BranchesEditor } from "./BranchesEditor";

export default async function BranchesSettingsPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  const ds = await getSettingsDataSource();
  const branches = await ds.getAllBranches();

  return (
    <div>
      <Link href="/admin/settings" className="text-sm text-muted hover:text-primary">
        ← 設定首頁
      </Link>
      <h1 className="mt-2 font-serif text-2xl font-medium">分店管理</h1>
      <p className="mt-1 text-sm text-muted">
        停用分店只會讓它從前台消失,既有預約與資源都會保留。
      </p>
      <BranchesEditor branches={branches} />
    </div>
  );
}
