# Booking 系統 UI 延伸規範(Sage Theme 補充)

> Base theme:全域 skill `~/.claude/skills/sage-theme-uiux/SKILL.md`(Sage Theme A335)。
> 本文件補充 booking 系統特有、base theme 沒覆蓋的 UI 場景。**兩份一起遵守;衝突時以本文件為準**(功能辨識優先於淡雅)。

---

## 1. 主題架構:Sage = 預設 base,每店可換

- 全部顏色走 **CSS variables**(Tailwind theme 對接),`shop.config.ts` 覆寫。
- Sage palette 是 **template 預設**(最適合 yoga / pilates / gym);雪板店等自行換主色(如冰川藍 `#6B9BB5`),中性色與排版規則不變。

```css
:root {
  /* base(每店可覆寫)*/
  --color-primary:   #A3B5A1;  /* sage green;雪板店換藍 */
  --color-secondary: #D2B48C;
  --color-bg:        #F8F5F0;
  --color-surface:   #FFFFFF;
  --color-text:      #333333;
  --color-muted:     #8A8A82;
}
```

## 2. 狀態語意色 ⭐(每店不可覆寫,全 template 統一)

Sage 低對比哲學不適用於狀態辨識 —— 狀態色柔化但**必須一眼可分**,文字對比需過 WCAG AA:

```css
:root {
  --status-available: #6B8E5A;  /* 有位:比主色深的綠,可讀 */
  --status-full:      #C17B6F;  /* 已滿:muted terracotta(柔和紅)*/
  --status-pending:   #D4A95E;  /* 待確認:muted amber */
  --status-closed:    #C9C9C0;  /* 休息/關閉:淡灰 */
  --status-cancelled: #9B9B93;  /* 已取消 */
}
```

- 不能只靠顏色:格子/badge 同時帶**文字或圖示**(滿、休、✓),照顧色弱使用者。
- 狀態色用於:週曆格、badge、我的預約清單、admin 審核列。

## 3. 週曆 Timetable Grid

- **結構**:CSS Grid;縱軸時間、橫軸 7 天(桌面)。時間軸刻度隨 slot 密度 30 或 60 分鐘。
- **格子(slot cell)**:
  - 填色 = **狀態色**(淡化背景 + 深色文字),圓角 6–8px,內距緊湊(此處不套 base theme 的大留白)。
  - **資源顏色**(教練/房間的 `color`)只用**左側 4px 色條或小圓點**,不做整格填色 —— 避免與狀態色打架。
  - 內容:時間、課程/服務名、模式 A 加 `已約/總數`;高度依 duration 等比。
  - 最小可點擊面積 **44×44px**(手機 touch target)。
- **手機(<768px)**:一次一天、左右滑或日期 tab;格子改為**全寬列表卡**(時間左、內容中、狀態 badge 右)。
- **特殊日期**:整欄淡灰背景 + 頂部標籤(「春節休」),用 `--status-closed`。
- 整店視角資源多時:提供資源色點圖例 + 點選篩選。

## 4. 志願選擇(模式 A 表單)

- 時段以**可勾選卡片/chip** 呈現:未選 = surface 底 + 邊框;已選 = 主色淡底 + 主色邊框 + 左上**志願序號圓標**(1、2、3…)。
- 勾選順序 = 志願序;取消中間一個,後面序號自動遞補。
- 已滿時段不出現在清單(不是 disabled,直接不列)。

## 5. 狀態 Badge(全站統一)

| 狀態 | 樣式 |
|---|---|
| 待確認 pending | `--status-pending` 淡底 + 深字 + 「待確認」 |
| 已確認 approved | `--status-available` 淡底 + 「已確認」 |
| 已拒絕 rejected / 已取消 cancelled | 灰底 + 刪節字樣 |
| 已完成 completed | 中性底 + 「已上課」 |

圓角全圓(pill),字級 12–13px,與 base theme 按鈕圓角語彙一致。

## 6. Admin 後台(工具型 UI,不是形象頁)

- **密度優先**:表格行高緊湊(40–44px),留白比前台小;仍用 base 中性色 + 圓角卡包裹。
- **審核列**:一列一申請,志願 chips 內嵌顯示「該志願目前餘額」;主要動作「✓ 確認」用 `--status-available` 實底按鈕,「✗ 拒絕」用外框次要按鈕。
- **破壞性動作**(拒絕、取消、停用資源):一律二次確認 dialog;danger 用 `--status-full` 而非鮮紅。
- **衝突警示**(請假/改開放時間影響既有預約):頂部 `--status-pending` 警示條 + 受影響清單逐筆處理,不可一鍵全取消。
- 空狀態:插圖或 icon + 一句話 + 主要 CTA(符合 base theme 的留白哲學)。

## 7. 表單與可用性

- 手機號輸入:`type="tel"`、自動格式 `09xx-xxx-xxx`、錯誤即時提示(`--status-full` 文字)。
- 送出中 loading 狀態、成功頁大 booking_id(等寬字體、可複製)。
- 焦點狀態一律 `--color-primary` 外框(base theme 規則)。
- 日期時間顯示:繁中 + 24 小時制,「6/30(二)11:00–13:00」格式。

## 8. Reviewer 檢查點(設計面)

- [ ] 狀態一眼可辨(不只靠顏色)且過 WCAG AA
- [ ] 資源色與狀態色未混用(資源=色條/點,狀態=填色)
- [ ] 手機週曆為單日檢視、touch target ≥44px
- [ ] 顏色全走 CSS variables,無 hardcode hex 在元件裡
- [ ] 前台遵守 Sage 留白/字體階層;admin 允許高密度但同語彙
