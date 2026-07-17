/**
 * /book — 線上預約(P3,模式 A 申請制)
 *
 * - Server component:查課程 + 資源 + 各課程「可預約」slots,組成 view model。
 * - 互動(選課 → 勾志願 → 填資料 → 送出)在 client component <BookFlow>。
 * - 只支援模式 A(bookingMode="request");模式 B(即時制)為 P8,見下方 guard。
 */

import type { Metadata } from "next";
import Link from "next/link";
import { shopConfig } from "@/config/shop.config";
import { getDataSource, hasSupabaseEnv } from "@/lib/data";
import { taipeiToday } from "@/lib/tz";
import { toBookableSlots } from "@/lib/booking/slot-view";
import type { BookableCourse, BookableSlot } from "@/lib/booking/types";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { getClientSession } from "@/lib/auth/client";
import { BookFlow } from "./BookFlow";
import { createBookingAction } from "./actions";

export const metadata: Metadata = {
  title: `${shopConfig.name}|線上預約`,
};

const CHANNEL_LABEL: Record<string, string> = {
  email: "電子郵件",
  whatsapp: "WhatsApp",
  line: "LINE",
};

function enabledChannelsLabel(): string {
  const on = (Object.keys(shopConfig.notifications) as Array<
    keyof typeof shopConfig.notifications
  >).filter((k) => shopConfig.notifications[k]);
  const labels = on.map((k) => CHANNEL_LABEL[k] ?? k);
  return labels.length > 0 ? labels.join("、") : "電話";
}

export default async function BookPage() {
  // 模式 B(即時制)尚未實作(P8);此頁僅供模式 A。
  if (shopConfig.bookingMode !== "request") {
    return (
      <div className="flex flex-1 flex-col">
        <SiteHeader active="/book" />
        <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
          <h1 className="font-serif text-2xl font-medium">即時預約即將推出</h1>
          <p className="text-sm leading-7 text-muted">
            本店採即時預約模式,線上預約功能建置中。
            {/* TODO(P8):模式 B 即時制表單 —— 選服務(時長)→ 選資源 + 起始時間 → 立即確認 */}
          </p>
          <Link
            href="/timetable"
            className="rounded-full border border-border bg-surface px-6 py-2.5 text-sm text-text hover:border-primary hover:text-primary"
          >
            查看週課表
          </Link>
        </main>
        <SiteFooter />
      </div>
    );
  }

  const ds = await getDataSource();
  const now = new Date();
  const clientSession = await getClientSession();

  // TODO(branches-ui): Pass 2 由分店選擇器決定;先固定第一間啟用分店。
  // 表單一次只能約一間分店 —— 志願跨分店會被 create_booking_request 以
  // mixed_branch 擋下(見 0005),所以可選 slot 必須先依分店收斂。
  const branches = await ds.getBranches();
  const branchId = branches[0]?.id;

  const [courseRows, resources] = await Promise.all([
    ds.getCourses(), // 課程為共用型錄,不分店
    ds.getResources(branchId),
  ]);

  const courses: BookableCourse[] = courseRows.map((c) => ({
    id: c.id,
    name: c.name,
    durationMin: c.duration_min,
    capacity: c.capacity,
    price: c.price,
  }));

  // 各課程「未來的全部 slots」(含已額滿),平行查詢後組成 view model。
  // 月曆日檢視需要把「未來但額滿」的時段以 disabled 列出(而非消失);
  // 是否可勾選 = 有空位(booked < capacity),由 client 端判斷。
  const slotLists = await Promise.all(
    courseRows.map((c) => ds.getCourseSlots(c.id, now, branchId)),
  );
  const slotsByCourse: Record<string, BookableSlot[]> = {};
  courseRows.forEach((c, i) => {
    slotsByCourse[c.id] = toBookableSlots(slotLists[i], resources);
  });

  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader active="/book" />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
        <div className="mb-6">
          <h1 className="font-serif text-2xl font-medium sm:text-3xl">
            線上預約
          </h1>
          <p className="mt-1 text-sm text-muted">
            選擇課程與多個志願時段,送出後由{" "}
            {shopConfig.resourceLabels[shopConfig.resourceType]}確認。時間為台北時間(24
            小時制)。
            {!hasSupabaseEnv() && "・目前為示範資料,送出不會實際成立預約。"}
          </p>
        </div>

        <BookFlow
          courses={courses}
          slotsByCourse={slotsByCourse}
          channelLabel={enabledChannelsLabel()}
          today={taipeiToday(now)}
          submit={createBookingAction}
          autofill={
            clientSession
              ? {
                  name: clientSession.name,
                  phone: clientSession.phone,
                  email: clientSession.email ?? "",
                }
              : undefined
          }
        />
      </main>
      <SiteFooter />
    </div>
  );
}
