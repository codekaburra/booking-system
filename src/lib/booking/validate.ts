/**
 * 送出表單的 server 端驗證(P3)。**server 端才是唯一真實來源**,不信任 client。
 *
 * 兩層:
 * 1. validateInputShape — 純函式,檢查欄位形狀(姓名/手機/至少一志願)。
 * 2. 時段可用性(未來 + 有空位 + 課程相符 + 仍存在)在 server action 內用
 *    「當下重新查到的 slots」比對(見 checkSlotsAvailable),避開瀏覽↔送出的競態。
 */

import type { BookableSlot, CreateBookingInput } from "./types";
import { isValidTwMobile, normalizePhone } from "./phone";

export interface ShapeError {
  field: "name" | "phone" | "slots" | "course";
  message: string;
}

/** 檢查欄位形狀;回傳錯誤清單(空 = 通過)+ 正規化後的手機 */
export function validateInputShape(input: CreateBookingInput): {
  errors: ShapeError[];
  normalizedPhone: string | null;
} {
  const errors: ShapeError[] = [];

  if (!input.courseId) {
    errors.push({ field: "course", message: "請選擇課程" });
  }
  if (!input.name?.trim()) {
    errors.push({ field: "name", message: "請填寫姓名" });
  }
  const normalizedPhone = normalizePhone(input.phone ?? "");
  if (!input.phone?.trim()) {
    errors.push({ field: "phone", message: "請填寫手機號碼" });
  } else if (!isValidTwMobile(input.phone)) {
    errors.push({ field: "phone", message: "手機號碼格式不正確(09xx-xxx-xxx)" });
  }
  if (!input.slotIds || input.slotIds.length === 0) {
    errors.push({ field: "slots", message: "請至少選擇一個志願時段" });
  } else if (hasDuplicateSlots(input.slotIds)) {
    // 同一 slot 不能同時被選為兩個志願(UI 已擋;server 為唯一真實來源仍再驗)。
    // 三層防呆之一:應用層(此)/ 0002 RPC guard / request_slots PK。
    errors.push({ field: "slots", message: "同一時段不可重複選為志願" });
  }

  return { errors, normalizedPhone };
}

/** slotIds 是否含重複(同一 slot 被選為多個志願) */
export function hasDuplicateSlots(slotIds: readonly string[]): boolean {
  return new Set(slotIds).size !== slotIds.length;
}

/**
 * 比對送出的 slotIds 與「當下可預約的 slots」:
 * 每個選取的 slot 必須仍在清單中(= 仍存在、未來、有空位、課程相符)。
 * 回傳無法預約的 slotId 清單(空 = 全部可用)。
 */
export function checkSlotsAvailable(
  slotIds: readonly string[],
  courseId: string,
  availableSlots: readonly BookableSlot[],
): string[] {
  const availableIds = new Set(
    availableSlots.filter((s) => s.courseId === courseId).map((s) => s.slotId),
  );
  return slotIds.filter((id) => !availableIds.has(id));
}
