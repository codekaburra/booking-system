import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth/admin";
import { getSettingsDataSource } from "@/lib/data/settings";
import { CoursesEditor } from "./CoursesEditor";

export default async function CoursesSettingsPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  const ds = await getSettingsDataSource();
  const courses = await ds.getAllCourses();

  return (
    <div>
      <Link href="/admin/settings" className="text-sm text-muted hover:text-primary">
        ← 設定首頁
      </Link>
      <h1 className="mt-2 font-serif text-2xl font-medium">課程 / 服務</h1>
      <CoursesEditor courses={courses} />
    </div>
  );
}
