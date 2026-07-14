import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth/admin";
import { getSettingsDataSource } from "@/lib/data/settings";
import { ResourceSettingsForm } from "./ResourceSettingsForm";

export default async function ResourceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  const { id } = await params;
  const ds = await getSettingsDataSource();
  const [resources, courses, rules, selectedCourseIds] = await Promise.all([
    ds.getAllResources(),
    ds.getAllCourses(),
    ds.getAvailabilityRules(id),
    ds.getResourceCourseIds(id),
  ]);
  const resource = resources.find((r) => r.id === id);
  if (!resource) notFound();

  return (
    <div>
      <Link
        href="/admin/settings/resources"
        className="text-sm text-muted hover:text-primary"
      >
        ← 資源列表
      </Link>
      <h1 className="mt-2 font-serif text-2xl font-medium">{resource.name}</h1>
      <ResourceSettingsForm
        resource={resource}
        courses={courses.filter((c) => c.is_active)}
        selectedCourseIds={selectedCourseIds}
        rules={rules}
      />
    </div>
  );
}
