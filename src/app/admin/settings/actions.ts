"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin";
import { getSettingsDataSource } from "@/lib/data/settings";

async function guard() {
  await requireAdmin();
}

export async function updateCourseAction(formData: FormData) {
  await guard();
  const id = String(formData.get("id"));
  const ds = await getSettingsDataSource();
  await ds.updateCourse(id, {
    name: String(formData.get("name") ?? "").trim(),
    duration_min: Number(formData.get("duration_min")),
    capacity: Number(formData.get("capacity")),
    price: Number(formData.get("price")),
    is_active: formData.get("is_active") === "on",
  });
  revalidatePath("/admin/settings/courses");
  return { ok: true as const };
}

export async function updateResourceAction(formData: FormData) {
  await guard();
  const id = String(formData.get("id"));
  const ds = await getSettingsDataSource();
  await ds.updateResource(id, {
    name: String(formData.get("name") ?? "").trim(),
    color: String(formData.get("color") ?? "").trim() || null,
    is_active: formData.get("is_active") === "on",
  });
  revalidatePath("/admin/settings/resources");
  revalidatePath(`/admin/settings/resources/${id}`);
  return { ok: true as const };
}

export async function saveResourceCoursesAction(formData: FormData) {
  await guard();
  const resourceId = String(formData.get("resourceId"));
  const courseIds = formData.getAll("courseId").map(String);
  const ds = await getSettingsDataSource();
  await ds.setResourceCourses(resourceId, courseIds);
  revalidatePath(`/admin/settings/resources/${resourceId}`);
  return { ok: true as const };
}

export async function addAvailabilityRuleAction(formData: FormData) {
  await guard();
  const resourceId = String(formData.get("resourceId"));
  const ds = await getSettingsDataSource();
  await ds.upsertAvailabilityRule(
    resourceId,
    Number(formData.get("weekday")),
    String(formData.get("start_time")),
    String(formData.get("end_time")),
  );
  revalidatePath(`/admin/settings/resources/${resourceId}`);
  return { ok: true as const };
}

export async function deleteAvailabilityRuleAction(formData: FormData) {
  await guard();
  const id = String(formData.get("id"));
  const resourceId = String(formData.get("resourceId"));
  const ds = await getSettingsDataSource();
  await ds.deleteAvailabilityRule(id);
  revalidatePath(`/admin/settings/resources/${resourceId}`);
  return { ok: true as const };
}

export async function createOverrideAction(formData: FormData) {
  await guard();
  const ds = await getSettingsDataSource();
  const type = String(formData.get("type")) as "closed" | "special_hours" | "extra_open";
  const resourceId = String(formData.get("resource_id") ?? "").trim() || undefined;
  await ds.createDateOverride({
    date: String(formData.get("date")),
    resourceId,
    type,
    startTime: String(formData.get("start_time") ?? "") || undefined,
    endTime: String(formData.get("end_time") ?? "") || undefined,
    reason: String(formData.get("reason") ?? "").trim() || undefined,
  });
  revalidatePath("/admin/settings/overrides");
  return { ok: true as const };
}

export async function deleteOverrideAction(formData: FormData) {
  await guard();
  const id = String(formData.get("id"));
  const ds = await getSettingsDataSource();
  await ds.deleteDateOverride(id);
  revalidatePath("/admin/settings/overrides");
  return { ok: true as const };
}

export async function importHolidaysAction(formData: FormData) {
  await guard();
  const year = Number(formData.get("year") ?? new Date().getFullYear());
  const ds = await getSettingsDataSource();
  const count = await ds.importTaiwanHolidays(year);
  revalidatePath("/admin/settings/overrides");
  return { ok: true as const, count };
}

export async function checkAffectedAction(formData: FormData) {
  await guard();
  const date = String(formData.get("date"));
  const resourceId = String(formData.get("resource_id") ?? "").trim() || null;
  const ds = await getSettingsDataSource();
  const affected = await ds.getAffectedBookings(date, resourceId);
  return { ok: true as const, affected };
}
