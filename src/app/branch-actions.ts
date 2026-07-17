"use server";

/**
 * 前台分店切換(PLAN.md §14)。
 *
 * 只寫 cookie(值 = slug),不做 URL routing —— 這**不是**已還原的 shop routing:
 * 分店是同一事業的據點,不是不同的店/租戶,所以沒有 `/分店` 路徑、沒有 middleware。
 */

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { getDataSource } from "@/lib/data";
import { BRANCH_COOKIE, BRANCH_COOKIE_MAX_AGE } from "@/lib/branch";

export async function selectBranchAction(formData: FormData) {
  const slug = String(formData.get("branch") ?? "").trim();
  // 只接受「啟用中分店」的 slug —— 不信任表單值
  const ds = await getDataSource();
  const branch = await ds.getBranchBySlug(slug);
  if (!branch) return { ok: false as const };

  (await cookies()).set(BRANCH_COOKIE, branch.slug, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: BRANCH_COOKIE_MAX_AGE,
  });
  // 週曆 / 預約表單都依 cookie 查資料 → 整站 RSC 快取需重算
  revalidatePath("/", "layout");
  return { ok: true as const };
}
