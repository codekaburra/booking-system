/**
 * 志願序邏輯(模式 A 表單,設計規範 §4)。
 *
 * - 勾選順序 = 志願序;取消中間一個,後面序號自動遞補。
 * - 這裡把「已選 slot id 的有序清單」當成單一真實來源(source of truth):
 *   preference_order = index + 1。純函式,client 與 server 端共用。
 */

/** 切換某個 slot 的勾選狀態;維持勾選先後順序(= 志願序) */
export function togglePreference(
  selected: readonly string[],
  slotId: string,
): string[] {
  return selected.includes(slotId)
    ? selected.filter((id) => id !== slotId) // 取消 → 其餘自動遞補(index 重排)
    : [...selected, slotId]; // 新增 → 接在最後(志願序最大)
}

/** slotId → 志願序(1-based);未選回傳 0 */
export function preferenceOrderOf(
  selected: readonly string[],
  slotId: string,
): number {
  return selected.indexOf(slotId) + 1;
}
