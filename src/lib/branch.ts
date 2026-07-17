/**
 * 分店選擇(PLAN.md §14)— server 端解析「目前看的是哪一間分店」。
 *
 * 模型:一個事業、一次部署、多間**分店**(branches 是 DATA,不是租戶/不是多店)。
 *
 * 持久化:cookie `branch` 存分店 **slug**(非 id)——
 *   - slug 穩定、可讀,分店重建 id 也不會讓 cookie 指向錯的店;
 *   - httpOnly:只有 server 需要讀它(RSC 直接讀 cookie 決定要查哪一間分店);
 *   - cookie 失效/指向已停用或不存在的分店 → 靜默退回第一間啟用分店。
 *
 * ⚠️ 週曆/表單的分店合約(見 src/lib/timetable.ts 檔頭):資料一次只能餵一間分店的
 * (resources / slots / overrides / rules),否則 A 店的公休會套到 B 店的資源上。
 * 本檔的 `selected.id` 就是各頁往資料層傳的那個 branchId。
 */

import "server-only";

import { cookies } from "next/headers";
import type { Branch } from "@/types/db";
import { getDataSource } from "@/lib/data";

/** 分店選擇 cookie(值 = branches.slug) */
export const BRANCH_COOKIE = "branch";
/** 一年 */
export const BRANCH_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export interface BranchSelection {
  /** 啟用中的分店(sort_order → name) */
  branches: Branch[];
  /** 目前選擇的分店;無任何啟用分店時為 null */
  selected: Branch | null;
  /**
   * 是否要顯示分店選擇器。
   * 單一分店的事業 = false → 介面完全不出現分店字樣,顧客不必多按一次(PLAN §14)。
   */
  showSelector: boolean;
}

/**
 * 解析目前分店:cookie slug → 找不到則第一間啟用分店。
 * 只在 Server Component / Server Action 內呼叫。
 */
export async function getBranchSelection(): Promise<BranchSelection> {
  const ds = await getDataSource();
  const branches = await ds.getBranches();
  const slug = (await cookies()).get(BRANCH_COOKIE)?.value;
  const selected = branches.find((b) => b.slug === slug) ?? branches[0] ?? null;
  return { branches, selected, showSelector: branches.length > 1 };
}
