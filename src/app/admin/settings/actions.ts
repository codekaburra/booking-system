"use server";

import { revalidatePath } from "next/cache";
import { shopConfig } from "@/config/shop.config";
import { requireAdmin } from "@/lib/auth/admin";
import { getSettingsDataSource } from "@/lib/data/settings";

async function guard() {
  await requireAdmin();
}

/** 分店 slug:小寫英數 + 連字號(前台 cookie 存的就是它) */
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// --- 分店(PLAN.md §14)-------------------------------------------------------

export async function createBranchAction(formData: FormData) {
  await guard();
  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim().toLowerCase();
  if (!name) return { ok: false as const, message: "請填寫分店名稱" };
  if (!SLUG_RE.test(slug)) {
    return { ok: false as const, message: "識別碼只能用小寫英數與連字號(例:taipei-main)" };
  }
  const ds = await getSettingsDataSource();
  try {
    await ds.createBranch({
      name,
      slug,
      address: String(formData.get("address") ?? "").trim() || undefined,
      sortOrder: Number(formData.get("sort_order") ?? 0) || 0,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("slug") || msg.includes("duplicate") || msg.includes("unique")) {
      return { ok: false as const, message: "識別碼已被其他分店使用" };
    }
    return { ok: false as const, message: "新增失敗,請稍後再試。" };
  }
  revalidateBranchSurfaces();
  return { ok: true as const };
}

export async function updateBranchAction(formData: FormData) {
  await guard();
  const id = String(formData.get("id"));
  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim().toLowerCase();
  if (!name) return { ok: false as const, message: "請填寫分店名稱" };
  if (!SLUG_RE.test(slug)) {
    return { ok: false as const, message: "識別碼只能用小寫英數與連字號(例:taipei-main)" };
  }
  const ds = await getSettingsDataSource();
  try {
    await ds.updateBranch(id, {
      name,
      slug,
      address: String(formData.get("address") ?? "").trim() || null,
      sort_order: Number(formData.get("sort_order") ?? 0) || 0,
      is_active: formData.get("is_active") === "on",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("slug") || msg.includes("duplicate") || msg.includes("unique")) {
      return { ok: false as const, message: "識別碼已被其他分店使用" };
    }
    return { ok: false as const, message: "更新失敗,請稍後再試。" };
  }
  revalidateBranchSurfaces();
  return { ok: true as const };
}

/**
 * 分店異動會影響前台選擇器、週曆與預約表單(它們都以 cookie 的分店 slug 查資料),
 * 所以整站 layout 一起重算。
 */
function revalidateBranchSurfaces() {
  revalidatePath("/admin/settings/branches");
  revalidatePath("/", "layout");
}

export async function createResourceAction(formData: FormData) {
  await guard();
  const branchId = String(formData.get("branch_id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  // 每個資源只屬於一間分店 → 新增時分店必選(PLAN §14)
  if (!branchId) return { ok: false as const, message: "請選擇分店" };
  if (!name) return { ok: false as const, message: "請填寫名稱" };
  const ds = await getSettingsDataSource();
  await ds.createResource({
    branchId,
    name,
    type: shopConfig.resourceType,
    color: String(formData.get("color") ?? "").trim() || undefined,
  });
  revalidatePath("/admin/settings/resources");
  revalidatePath("/", "layout");
  return { ok: true as const };
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

/**
 * 新增特殊日期。表單一律帶 branch_id(頁面的分店 picker):
 * - 未選資源 → 「該分店全店」公休/特殊營業(**只**影響這間分店)。
 * - 有選資源 → 分店由該資源推導,branch_id 必須與之一致(0005 的 trigger 也會擋)。
 */
export async function createOverrideAction(formData: FormData) {
  await guard();
  const ds = await getSettingsDataSource();
  const type = String(formData.get("type")) as "closed" | "special_hours" | "extra_open";
  const resourceId = String(formData.get("resource_id") ?? "").trim() || undefined;
  const branchId = String(formData.get("branch_id") ?? "").trim() || undefined;
  if (!branchId && !resourceId) {
    return { ok: false as const, message: "請選擇分店" };
  }
  try {
    await ds.createDateOverride({
      date: String(formData.get("date")),
      branchId,
      resourceId,
      type,
      startTime: String(formData.get("start_time") ?? "") || undefined,
      endTime: String(formData.get("end_time") ?? "") || undefined,
      reason: String(formData.get("reason") ?? "").trim() || undefined,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("branch_mismatch")) {
      return { ok: false as const, message: "該資源不屬於這間分店,請重新選擇。" };
    }
    if (msg.includes("branch_required")) {
      return { ok: false as const, message: "請選擇分店" };
    }
    return { ok: false as const, message: "新增失敗,請稍後再試。" };
  }
  revalidatePath("/admin/settings/overrides");
  revalidatePath("/", "layout"); // 前台週曆吃 override
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
  // TODO(branches-ui): 分店級公休應只查該分店 → Pass 2 表單帶 branch_id 進來。
  // 目前不帶 = 跨分店查(寧可多報也不漏報,漏報才會讓客人白跑)。
  const branchId = String(formData.get("branch_id") ?? "").trim() || undefined;
  const ds = await getSettingsDataSource();
  const affected = await ds.getAffectedBookings(date, resourceId, branchId);
  return { ok: true as const, affected };
}
