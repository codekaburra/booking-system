"use server";

/**
 * 模式 A 送出預約的 Server Action(P3)。
 *
 * **server 端才是唯一真實來源**:即使 client 已擋過,這裡一律重新做
 *   1. 欄位形狀驗證(validateInputShape;含志願去重)。
 *   2. 時段可用性:以「當下重新查到的可預約 slots」比對送出的 slotIds
 *      —— 關掉「瀏覽 → 送出」之間別人把位子占走 / slot 過期的競態。
 * 通過後才呼叫 getDataSource().createBooking(...)(真實後端在 DB 函式內再驗一次 +
 * 交易寫入;此處不動 booked_count —— 佔位是 P4 approve 的事)。
 */

import { getDataSource } from "@/lib/data";
import { toBookableSlots } from "@/lib/booking/slot-view";
import {
  checkSlotsAvailable,
  validateInputShape,
  type ShapeError,
} from "@/lib/booking/validate";
import type {
  BookingSummary,
  CreateBookingInput,
} from "@/lib/booking/types";

export interface BookActionResult {
  ok: boolean;
  bookingId?: string;
  /** demo 模式(未實際寫入 DB) */
  demo?: boolean;
  /** 成功時的摘要(狀態頁顯示用) */
  summary?: BookingSummary;
  /** 欄位形狀錯誤(姓名/手機/課程/志願) */
  fieldErrors?: ShapeError[];
  /** 送出當下已無法預約的 slotId(請使用者回上一步重選) */
  unavailableSlotIds?: string[];
  /** 一般性錯誤訊息 */
  message?: string;
}

export async function createBookingAction(
  input: CreateBookingInput,
): Promise<BookActionResult> {
  // 1. 形狀驗證(server 權威;不信任 client)
  const { errors } = validateInputShape(input);
  if (errors.length > 0) {
    return { ok: false, fieldErrors: errors };
  }

  const ds = await getDataSource();

  // 課程需為啟用中
  const course = await ds.getCourseById(input.courseId);
  if (!course) {
    return {
      ok: false,
      fieldErrors: [{ field: "course", message: "課程不存在或已停售,請重新選擇" }],
    };
  }

  // 2. 可用性重驗:以「當下」可預約 slots 比對(競態防線)
  const now = new Date();
  const [slots, resources] = await Promise.all([
    ds.getBookableSlots(input.courseId, now),
    ds.getResources(),
  ]);
  const available = toBookableSlots(slots, resources);

  const unavailable = checkSlotsAvailable(
    input.slotIds,
    input.courseId,
    available,
  );
  if (unavailable.length > 0) {
    return {
      ok: false,
      unavailableSlotIds: unavailable,
      message: "部分時段已額滿或過期,請回上一步重新選擇。",
    };
  }

  // 3. 交易寫入(真實後端在 0002 DB 函式內再驗一次)
  let result;
  try {
    result = await ds.createBooking(input);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // DB 端最後防線拋出的可預期錯誤 → 轉為友善提示
    if (msg.includes("slot_unavailable")) {
      return { ok: false, message: "部分時段剛剛額滿,請回上一步重新選擇。" };
    }
    if (msg.includes("duplicate_slot")) {
      return {
        ok: false,
        fieldErrors: [{ field: "slots", message: "同一時段不可重複選為志願" }],
      };
    }
    return { ok: false, message: "送出失敗,請稍後再試。" };
  }

  // 摘要:依志願序組出顯示資料(slotIds 已是志願序)
  const byId = new Map(available.map((s) => [s.slotId, s]));
  const summary: BookingSummary = {
    name: input.name.trim(),
    courseName: course.name,
    preferences: input.slotIds.map((id, i) => {
      const s = byId.get(id);
      return {
        order: i + 1,
        dayLabel: s?.dayLabel ?? "",
        timeLabel: s?.timeLabel ?? "",
        resourceName: s?.resourceName ?? "—",
        resourceColor: s?.resourceColor ?? null,
      };
    }),
  };

  return {
    ok: true,
    bookingId: result.bookingId,
    demo: result.demo,
    summary,
  };
}
