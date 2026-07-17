/**
 * /timetable — 週曆 Timetable(P2,唯讀;P-branches 起以分店為單位)
 *
 * - ?week=YYYY-MM-DD:任一日期,正規化為該週(台北)週一;預設本週。
 * - ?resource=<id>:單一資源視角;缺省 = 該分店總覽。
 * - ?view=day:整店視角下改看「依資源分欄的日檢視」(欄 = 該分店的資源);
 *   缺省 = 週檢視。單一資源視角只有週檢視(分欄沒有意義)。
 * - 分店:由 cookie 決定(src/lib/branch.ts);**一次只查一間分店**的
 *   resources / slots / overrides / rules —— buildWeekView 是純函式、不會自己過濾,
 *   混餵多分店資料會把 A 店的公休套到 B 店的資源上(見 src/lib/timetable.ts 檔頭)。
 * - Server component 查資料 + 計算 view model;互動(資源切換、手機單日
 *   切換)才用 client component。
 */

import type { Metadata } from "next";
import Link from "next/link";
import { shopConfig } from "@/config/shop.config";
import { getDataSource, hasSupabaseEnv } from "@/lib/data";
import { buildWeekView } from "@/lib/timetable";
import {
  addDays,
  currentWeekMonday,
  isValidDateStr,
  mondayOf,
  shortDateLabel,
  taipeiToday,
} from "@/lib/tz";
import { getBranchSelection } from "@/lib/branch";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { DayResourceGrid } from "@/components/timetable/DayResourceGrid";
import { MobileDayView } from "@/components/timetable/MobileDayView";
import { ResourceSelect } from "@/components/timetable/ResourceSelect";
import { WeekGrid } from "@/components/timetable/WeekGrid";

export const metadata: Metadata = {
  title: `${shopConfig.name}|週課表`,
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

type ViewMode = "week" | "day";

function weekHref(
  week: string,
  resourceId: string | null,
  view: ViewMode = "week",
): string {
  const params = new URLSearchParams({ week });
  if (resourceId) params.set("resource", resourceId);
  if (view === "day") params.set("view", "day");
  return `/timetable?${params.toString()}`;
}

export default async function TimetablePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const weekParam = first(sp.week);
  const resourceParam = first(sp.resource);
  const view: ViewMode = first(sp.view) === "day" ? "day" : "week";

  const thisMonday = currentWeekMonday(); // 以 Asia/Taipei 計算「本週一」
  const weekStart = isValidDateStr(weekParam) ? mondayOf(weekParam) : thisMonday;
  const weekEnd = addDays(weekStart, 6);

  const ds = await getDataSource();

  // 分店選擇器(cookie)決定要看哪一間。**不可**改成不帶 branchId:週曆一次只能顯示
  // 一間分店,因為 date_overrides 的 resource_id = null 代表「該分店全店」,混著多間
  // 分店的 override 會把 A 店的公休套到 B 店的資源上(buildWeekView / resolveResourceDay
  // 收到的資料必須已依分店過濾)。
  const { selected: branch, showSelector } = await getBranchSelection();
  const branchId = branch?.id;

  const [resources, courses, slots, overrides, rules] = await Promise.all([
    ds.getResources(branchId),
    ds.getCourses(), // 課程為共用型錄,不分店
    ds.getWeekSlots(weekStart, branchId),
    ds.getDateOverrides(weekStart, weekEnd, branchId),
    ds.getAvailabilityRules(branchId),
  ]);

  const selected = resources.find((r) => r.id === resourceParam) ?? null;
  const shown = selected ? [selected] : resources;

  const week = buildWeekView({
    weekStart,
    resources: shown,
    singleView: Boolean(selected),
    courses,
    slots,
    overrides,
    rules,
  });

  const today = taipeiToday();
  const mobileInitialDate = week.days.some((d) => d.date === today)
    ? today
    : weekStart;
  const resourceLabel = shopConfig.resourceLabels[shopConfig.resourceType];
  const navBtn =
    "flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-surface text-lg text-text hover:border-primary hover:text-primary";
  const toggleBtn = (on: boolean) =>
    `flex h-11 items-center rounded-lg border px-3 text-sm ${
      on
        ? "border-primary bg-primary/15 font-medium text-primary"
        : "border-border bg-surface text-text hover:border-primary hover:text-primary"
    }`;

  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader active="/timetable" />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="font-serif text-2xl font-medium sm:text-3xl">
                週課表
              </h1>
              <p className="mt-1 text-sm text-muted">
                {/* 單一分店的事業不提「分店」二字(showSelector = false) */}
                {showSelector && branch ? `${branch.name}・` : ""}
                時間為台北時間(24 小時制)
                {!hasSupabaseEnv() && "・目前顯示示範資料"}
              </p>
            </div>
            <Link
              href="/book"
              className="rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-surface shadow-sm transition hover:opacity-90"
            >
              線上預約
            </Link>
          </div>

          {/* 週導覽 + 視角切換 */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Link
                aria-label="上一週"
                href={weekHref(addDays(weekStart, -7), selected?.id ?? null, view)}
                className={navBtn}
              >
                ‹
              </Link>
              <span className="min-w-32 text-center text-sm font-medium">
                {weekStart.replaceAll("-", "/")} – {shortDateLabel(weekEnd)}
              </span>
              <Link
                aria-label="下一週"
                href={weekHref(addDays(weekStart, 7), selected?.id ?? null, view)}
                className={navBtn}
              >
                ›
              </Link>
              {weekStart !== thisMonday && (
                <Link
                  href={weekHref(thisMonday, selected?.id ?? null, view)}
                  className="flex h-11 items-center rounded-lg border border-border bg-surface px-3 text-sm text-text hover:border-primary hover:text-primary"
                >
                  回本週
                </Link>
              )}
            </div>

            <ResourceSelect
              options={resources.map((r) => ({ id: r.id, name: r.name }))}
              selectedId={selected?.id ?? null}
              week={weekStart}
              view={view}
              label={resourceLabel}
            />

            {/* 檢視切換:週(欄 = 日)/ 單日(欄 = 該分店的資源)。
                單一資源視角沒有分欄的意義 → 不提供。 */}
            {!selected && (
              <div
                role="group"
                aria-label="檢視方式"
                className="flex items-center gap-1"
              >
                <Link
                  href={weekHref(weekStart, null, "week")}
                  aria-current={view === "week" ? "true" : undefined}
                  className={toggleBtn(view === "week")}
                >
                  週檢視
                </Link>
                <Link
                  href={weekHref(weekStart, null, "day")}
                  aria-current={view === "day" ? "true" : undefined}
                  className={toggleBtn(view === "day")}
                >
                  單日・分{resourceLabel}
                </Link>
              </div>
            )}
          </div>

          {/* 圖例:狀態 + (整店視角)資源色點,可點選篩選 */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted">
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded border border-status-available/40 bg-status-available/20" />
              有位
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded border border-status-full/40 bg-status-full/20" />
              已滿
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded bg-status-closed/40" />
              休息/已過
            </span>
            {!selected &&
              view === "week" &&
              resources.map((r) => (
                <Link
                  key={r.id}
                  href={weekHref(weekStart, r.id)}
                  className="flex min-h-11 items-center gap-1.5 hover:text-text"
                  title={`只看${r.name}`}
                >
                  <span
                    aria-hidden
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: r.color ?? "var(--color-muted)" }}
                  />
                  {r.name}
                </Link>
              ))}
          </div>
        </div>

        {resources.length === 0 ? (
          <p className="rounded-xl border border-border bg-surface p-8 text-center text-sm text-muted">
            {showSelector && branch
              ? `${branch.name}目前沒有可預約的${resourceLabel}。`
              : `目前沒有可預約的${resourceLabel}。`}
          </p>
        ) : view === "day" ? (
          // 單日・依資源分欄:欄 = 該分店的資源(教練/場地多時一眼看完當天狀況)。
          // 自帶日期切換與橫向捲動 → 桌機/手機同一元件。
          <DayResourceGrid week={week} initialDate={mobileInitialDate} />
        ) : (
          <>
            {/* 桌面:7 欄週格線 */}
            <div className="hidden md:block">
              <WeekGrid week={week} />
            </div>
            {/* 手機:一次一天 */}
            <div className="md:hidden">
              <MobileDayView week={week} initialDate={mobileInitialDate} />
            </div>
          </>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
