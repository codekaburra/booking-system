/**
 * 對外預約碼 booking_id 生成(P3)。
 *
 * 格式:BK-YYYYMMDD-XXXX
 * - YYYYMMDD:送出當日的 **Asia/Taipei** 日期(不可用 server 本地時區)。
 * - XXXX:4 碼 Crockford base32 亂數(去掉易混字 I L O U),碰撞機率低;
 *   唯一鍵衝突時由呼叫端重試(DB 端 booking_id 有 unique 約束)。
 *
 * 純函式 + 可注入亂數 → 便於離線測試格式與台北日期歸屬。
 */

import { taipeiToday } from "@/lib/tz";

/** Crockford base32(排除 I L O U,避免與 1/0 混淆)。
 *  ⚠️ 必須與 supabase/migrations/0002 內的 v_alphabet 完全一致
 *  (demo 產碼與真實後端產碼同字母表)。 */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** 產生 n 碼隨機 base32 字串;randomInt 預設用 crypto,可注入以測試 */
export function randomCode(
  n = 4,
  randomInt: (max: number) => number = cryptoRandomInt,
): string {
  let out = "";
  for (let i = 0; i < n; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

function cryptoRandomInt(max: number): number {
  // globalThis.crypto 在 Node 18+ / Edge / 瀏覽器皆可用
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] % max;
}

/**
 * 產生完整 booking_id。
 * @param now 送出時間(預設現在);日期部分以 Asia/Taipei 歸屬。
 */
export function generateBookingId(
  now: Date = new Date(),
  randomInt?: (max: number) => number,
): string {
  const datePart = taipeiToday(now).replaceAll("-", ""); // YYYYMMDD
  return `BK-${datePart}-${randomCode(4, randomInt)}`;
}

/** 驗證 booking_id 格式(回查頁參數防呆用) */
export function isValidBookingId(s: string | undefined | null): s is string {
  return typeof s === "string" && /^BK-\d{8}-[0-9A-HJKMNP-TV-Z]{4}$/.test(s);
}
