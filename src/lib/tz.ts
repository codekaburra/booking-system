/**
 * Asia/Taipei 時區工具(P2)
 *
 * 鐵則:所有「日期歸屬、週一計算、今天判斷」一律以 Asia/Taipei 為準,
 * 不可依賴 server 本地時區。
 *
 * 實作方式:
 * - UTC instant → 台北日期/時間:用 Intl.DateTimeFormat(timeZone: "Asia/Taipei")。
 * - 台北牆上時間 → UTC instant:台灣自 1980 年起無日光節約時間,固定 UTC+8,
 *   直接以 "+08:00" offset 組 ISO 字串(不需要第三方時區庫)。
 * - 純日曆運算(加減天數、星期、週一)用 Date.UTC 做,與任何時區無關。
 */

const TAIPEI_TZ = "Asia/Taipei";
const TAIPEI_OFFSET = "+08:00";

/** en-CA 的日期格式正好是 YYYY-MM-DD */
const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TAIPEI_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const timeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: TAIPEI_TZ,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** UTC instant → 台北當地日期 "YYYY-MM-DD" */
export function taipeiDateOf(instant: Date): string {
  return dateFormatter.format(instant);
}

/** UTC instant → 台北當地時間 "HH:MM"(24 小時制) */
export function taipeiTimeOf(instant: Date): string {
  return timeFormatter.format(instant);
}

/** 今天(台北)的 "YYYY-MM-DD" */
export function taipeiToday(now: Date = new Date()): string {
  return taipeiDateOf(now);
}

/** 台北當地 "YYYY-MM-DD" + "HH:MM[:SS]" → UTC instant */
export function taipeiInstant(dateStr: string, timeStr = "00:00"): Date {
  const t = timeStr.length === 5 ? `${timeStr}:00` : timeStr;
  return new Date(`${dateStr}T${t}${TAIPEI_OFFSET}`);
}

/** 純日曆運算(與時區無關):日期字串加減天數 */
export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** 日期字串的星期(0=週日…6=週六;同 DB availability_rules.weekday 慣例) */
export function weekdayOf(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** 該日期所屬週(週一為首)的週一 */
export function mondayOf(dateStr: string): string {
  return addDays(dateStr, -((weekdayOf(dateStr) + 6) % 7));
}

/** 本週一(台北) */
export function currentWeekMonday(now: Date = new Date()): string {
  return mondayOf(taipeiToday(now));
}

/** 驗證 "YYYY-MM-DD" 格式且為真實存在的日期 */
export function isValidDateStr(s: string | undefined | null): s is string {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

/** "HH:MM[:SS]" → 自當日 00:00 起算的分鐘數 */
export function minutesOfTime(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

/** UTC instant → 台北當日分鐘數(自 00:00 起算) */
export function taipeiMinutesOf(instant: Date): number {
  return minutesOfTime(taipeiTimeOf(instant));
}

/** 分鐘數 → "HH:MM"(供時間軸刻度顯示) */
export function formatMinutes(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

const WEEKDAY_ZH = ["日", "一", "二", "三", "四", "五", "六"] as const;

/** 星期中文字(「一」…「日」) */
export function weekdayZh(dateStr: string): string {
  return WEEKDAY_ZH[weekdayOf(dateStr)];
}

/** "M/D" 短日期(顯示用) */
export function shortDateLabel(dateStr: string): string {
  const [, m, d] = dateStr.split("-").map(Number);
  return `${m}/${d}`;
}
