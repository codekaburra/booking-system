# 開發進度(接手必讀)

> 規劃見 [PLAN.md](PLAN.md);UI 規範見 [docs/design/booking-ui-extensions.md](docs/design/booking-ui-extensions.md)。
> **每完成一個 phase 就更新此檔並隨該 phase 一起 commit**,讓人類或任何 AI 都能接手。

## 進度總表

| Phase | 內容 | 狀態 | Branch / Commit |
|---|---|---|---|
| P0 | 規劃文件 | ✅ 完成 | `main` `70e6715` |
| P1 | 骨架 + 8 張表 schema + seed | ✅ 完成(已 review + 修正) | `p1-project-scaffold` `26f77e7`+`fc7d889` → [PR #1](https://github.com/codekaburra/booking-system/pull/1) 未 merge |
| P2 | 週曆 Timetable(整店/單資源、RWD、overrides) | 🔨 進行中 | `p2-timetable`(疊在 P1 上) |
| P3 | 預約表單(模式 A 多志願)+ client 歸戶 + 狀態頁 | ⬜ 未開始 | |
| P4 | 後台核心(admin auth、審核防超賣、Email、手動建預約/取消) | ⬜ 未開始 | |
| P5 | 客戶登入 + 我的預約 + 設定後台 + 特殊日期管理 | ⬜ 未開始 | |
| P6 | 打磨(提醒 cron、自助取消、slot 生成排程、通知管道) | ⬜ 未開始 | |
| P7 | Google Calendar 單向推送 | ⬜ 未開始 | |
| P8 | 即時制模式 B(時間範圍、防重疊) | ⬜ 未開始 | |

## 開發流程(每個 phase 固定走)

1. 從上一個 phase 的 branch 開新 branch(`p3-booking-form`、`p4-admin-core`…)
2. **developer** 實作(角色定義:`.claude/agents/developer.md`)
3. **reviewer** 只讀審查(`.claude/agents/reviewer.md`),輸出 🔴🟡🟢 問題清單
4. 修正 → 再驗證 → **一個 phase 一個(組)commit**,訊息格式 `P2: 週曆 Timetable — ...`
5. 更新本檔進度表 → push

## 驗證方式(每次改動後必跑)

```bash
npm run build && npm run lint
```
- SQL 改動:機器無 psql,用 PGlite 驗(P1 用過的腳本在 scratchpad,已遺失的話:npm i @electric-sql/pglite 後跑 migration+seed 再做一致性查詢)
- UI:npm run dev 後人工看(demo 模式:不設 Supabase env 會 fallback 到 src/lib/data/demo.ts 的假資料 — P2 起才有)

## 重要合約(實作時不能違反)

- **時區**:日期歸屬/週計算一律 Asia/Taipei;DB timestamptz 存 UTC,顯示才轉。
- **date_overrides 優先權**(migration 註解也有):overrides > rules;closed > special_hours > extra_open;資源級 > 全店級。
- **防超賣**:approve 必須在 transaction 內檢查 `booked_count < capacity`(DB CHECK 只是底線)。
- **狀態色 token**(`--status-*`)每店不可覆寫;狀態不能只靠顏色,要帶字/圖示。資源色只做色條/圓點。
- **店家資訊**只放 `src/config/shop.config.ts` + `.env`,不 hardcode。
- migration 已凍結:schema 要改就出新的 migration 檔,不改 0001。

## 目前技術狀態

- Next.js 16 + React 19 + Tailwind v4(CSS variables 對接 @theme inline,globals.css)
- Supabase:**尚未建立真實專案**,.env.example 有佔位;code 在 env 缺失時必須能 build + 以 demo 資料跑
- 尚未部署 Vercel
