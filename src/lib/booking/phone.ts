/**
 * 台灣手機號驗證與格式化(P3 表單 + server 端驗證共用純函式)。
 *
 * 規則:台灣手機為 09 開頭共 10 碼(09xx-xxx-xxx)。
 * - 接受使用者輸入含分隔號(- 或空白):0912-345-678、0912 345 678、0912345678。
 * - 正規化(normalizePhone)去除所有非數字,存 DB 一律純數字 10 碼
 *   (與 seed.sql 的 clients.phone 格式一致:'0912345678')。
 */

/** 去除非數字字元;回傳純數字字串 */
export function digitsOnly(input: string): string {
  return input.replace(/\D/g, "");
}

/** 是否為合法台灣手機號(允許輸入含分隔號) */
export function isValidTwMobile(input: string): boolean {
  return /^09\d{8}$/.test(digitsOnly(input));
}

/**
 * 正規化為存 DB 的形式(純數字 10 碼);非法輸入回傳 null。
 * DB 的 clients.phone 為唯一鍵,正規化確保「同一支手機」歸同一戶。
 */
export function normalizePhone(input: string): string | null {
  const d = digitsOnly(input);
  return /^09\d{8}$/.test(d) ? d : null;
}

/** 顯示格式 09xx-xxx-xxx(輸入框即時格式化 / 成功頁顯示用) */
export function formatTwMobile(input: string): string {
  const d = digitsOnly(input).slice(0, 10);
  if (d.length <= 4) return d;
  if (d.length <= 7) return `${d.slice(0, 4)}-${d.slice(4)}`;
  return `${d.slice(0, 4)}-${d.slice(4, 7)}-${d.slice(7)}`;
}
