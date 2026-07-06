# 預約系統 Booking System Template

可複製到多間店的預約系統 template(Next.js + Tailwind CSS + Supabase + Vercel)。
支援兩種預約模式:**申請制**(多志願 → 老闆確認)與**即時制**(選資源 + 起始時間 → 立即確認)。
完整規劃見 [PLAN.md](PLAN.md),UI 規範見 [docs/design/booking-ui-extensions.md](docs/design/booking-ui-extensions.md)。

## 本地啟動

```bash
npm install
cp .env.example .env.local   # 填入 Supabase 專案的 URL / keys
npm run dev                  # http://localhost:3000
```

檢查:

```bash
npm run build
npm run lint
```

## 資料庫

- Schema(8 張表):[supabase/migrations/0001_init.sql](supabase/migrations/0001_init.sql)
- 雪板店 demo 種子資料:[supabase/seed.sql](supabase/seed.sql)

在 Supabase Dashboard 的 SQL Editor 依序執行上述兩個檔案,
或用 Supabase CLI:`supabase db push` 後執行 seed。

## 開新店 checklist(目標 10 分鐘內)

1. 建 Supabase 專案(平台帳號只有一個,店 = 專案)
2. 跑 `supabase/migrations/0001_init.sql` 建表
3. 跑 seed 建初始資料 + admin 帳號(P4 之後)
4. 填 `.env.local` + 改 [src/config/shop.config.ts](src/config/shop.config.ts)
   (店名、slug、booking_mode、主題色、通知管道、資源稱呼)
5. Vercel 接上對應 branch(branch-per-shop,核心改一次 merge 進各店 branch)

每店差異只放 `shop.config.ts` + `.env`;營運資料(課程、教練、開放時間、預約)在各店 Supabase 後台管理。

## 專案結構

```
src/
  app/                 # Next.js App Router(頁面)
  config/shop.config.ts# 每店設定(店名、模式、主題色、通知…)
  lib/supabase.ts      # Supabase client(browser / server)
  types/db.ts          # 8 張表 TS 型別
supabase/
  migrations/          # DDL
  seed.sql             # demo 資料
docs/design/           # booking UI 延伸規範(base theme = sage-theme-uiux skill)
```

## 慣例

- 時區一律 `Asia/Taipei`;介面繁體中文、24 小時制。
- 顏色一律走 CSS variables(`src/app/globals.css`):base 色每店可覆寫,狀態語意色全 template 統一。
- 分階段開發(P1–P8)見 PLAN.md §10。
