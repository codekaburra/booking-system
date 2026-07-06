# 預約系統 Booking System — 規劃書 (PLAN)

> 純規劃文件,尚未寫 code。一套可複製到多間店、**什麼生意都能套**的預約系統 template。
> 範例情境 A(申請制):雪板學校 — 學生看週曆 → 填表選多個志願時段 → 老闆確認 → 通知。
> 範例情境 B(即時制):自助 gym / pilates / yoga — 客人選房間 + 起始時間 + 時長(30/45/60 分)→ 立即確認。

最後更新:2026-07-06

---

## 1. 專案目標

- 做一套**預約系統 template**,可套用到多間不同的店、不同型態的生意。
- 核心抽象:**可預約資源(resource)**+ **兩種預約模式**:
  - **資源** = 教練(課程店)或 房間(自助設施)或 器材…,介面稱呼由 config 決定。
  - **模式 A 申請制**:多志願 → 老闆確認(雪板課、有教練的課程店)。
  - **模式 B 即時制**:選資源 + 起始時間 + 時長 → 立即確認(自助 gym / pilates / yoga 小房間)。
- 不同店有不同**服務項目**、不同**時長**、不同**容納人數**、不同**資源**。
- 兩個核心畫面:
  1. **週曆 Timetable** — 顯示每週每天「已約 / 空位」(整店 / 單一資源視角)。
  2. **預約表單** — 模式 A 勾多個志願;模式 B 選起始時間 + 時長。
- 為台灣的店設計(時區 `Asia/Taipei`、繁體中文、台灣金流/通知習慣、**國定假日處理**)。

---

## 2. 技術棧與基礎設施

| 層 | 採用 |
|---|---|
| 前端 + 後端 | **Next.js (React)** + Tailwind CSS(RWD,手機優先) |
| 資料庫 | **PostgreSQL,由 Supabase 託管** |
| 登入 | **Supabase Auth**(guest / client / admin) |
| 部署 | **Vercel** |
| 檔案(教練照片、logo) | Supabase Storage |
| Email 通知 | Resend(免費額度) |
| WhatsApp 通知(選配) | WhatsApp Business API / Twilio |
| LINE 通知(選配) | LINE Messaging API(官方帳號) |
| Google Calendar(P7) | Google Service Account + Calendar API |

> **平台帳號**:Supabase、Vercel 各只開 **1 個帳號**,多間店是底下的多個專案。
> **網域**:每店一個網址(一年約 NT$300–500)。
> 起步基本上走免費額度,規模大了再升付費。

### 不採用 / 已排除
- ❌ 多租戶單一部署(改用每店分開 deploy,見 §3)
- ❌ AWS(改用 Supabase + Vercel,較省事)
- ❌ Cloudflare 全家桶 / D1(維持 PostgreSQL;Cloudflare 之後最多當 CDN,選配)
- ❌ Notion 當顯示層
- ❌ Google Calendar 雙向同步(只做單向推送)
- ❌ LINE Login(改為免登入也能 book)
- ❌ PHP / OpenCart 電商式賣課(需求是真正的時段預約)

---

## 3. 部署模式:每店分開 deploy

每間店 = 一個獨立部署,實體隔離(隔離性最強、可大幅客製)。

```
template repo (一份核心程式)
   │  branch-per-shop(建議:核心改一次 → merge 進各店 branch)
   ├── 雪板店  branch → 自己的 Supabase 專案 → 部署到 snowboard.com
   ├── 瑜伽店  branch → 自己的 Supabase 專案 → 部署到 yoga.com
   └── ...
```

### 讓 N 個部署不那麼累
- 平台帳號各 1 個(Supabase / Vercel),登入一次看全部專案。
- **branch-per-shop**:同一 repo 開不同 branch,核心修一次 merge 到各店,不維護 N 份碼。
- 命名規則:`booking-雪板`、`booking-瑜伽`…。
- **開新店 checklist**(目標 10 分鐘內):
  1. 建 Supabase 專案
  2. 跑建表腳本(schema)
  3. 跑 seed 建一個 admin 帳號
  4. 填 `.env` + 改 `shop.config.ts`
  5. Vercel 接上對應 branch / repo

### 每店差異放哪
| 類型 | 位置 | 例子 |
|---|---|---|
| 靜態品牌設定 | `shop.config.ts` + `.env` | 店名、logo、時區、主色、開啟的通知管道、Google 設定 |
| 營運資料 | 各店 Supabase(後台可改) | 課程、時長、容量、開放時間、教練、預約 |

---

## 4. 使用者角色

| 角色 | 登入? | 能做什麼 |
|---|---|---|
| **訪客 guest** | 不用 | 直接 book(**手機號必填**)→ 拿 booking id + 收通知 |
| **客戶 client** | 可登入 | 登入後 book(資料自動帶入)+ 看「我的預約」歷史 |
| **老闆 admin** | 要登入 | 審核預約、管理課程/教練/開放時間、看所有客戶 |

> 登入用 Supabase Auth,以 `role` 區分。客戶登入是選配便利功能;不登入照樣能 book(免登入降低 friction)。

---

## 5. 資料表(8 張)

> 因每店分開部署,**不需要** `shop_id` 與多租戶 RLS。

```
clients ──< booking_requests ──< request_slots >── slots >── resources
                     │(approved 後帶 resource_id     └────── courses
                     │  + starts_at/ends_at)
availability_rules ── resources
date_overrides ────── resources(可空 = 全店)
```

### clients(客戶)
| 欄位 | 說明 |
|---|---|
| id | client_id |
| name | 姓名 |
| phone | **必填、唯一**(用來歸戶:同手機 = 同一人) |
| email | 選填 |
| line_user_id | 選填(LINE 通知用) |
| preferred_channel | email / whatsapp / line |
| auth_user_id | 登入後綁 Supabase Auth;訪客留空 |
| note | 備註 |
| created_at | |

### courses(課程)
| 欄位 | 說明 |
|---|---|
| id | |
| name | 課程名稱(私人課 / 團體課…) |
| duration_min | **上課時長(分鐘)** |
| capacity | **每堂容納人數**(1 = 私人;8 = 團體) |
| price | 價格 |
| is_active | 是否啟用 |

### resources(可預約資源:教練 / 房間 / 器材)
| 欄位 | 說明 |
|---|---|
| id | |
| type | instructor / room / equipment(介面稱呼由 `shop.config.ts` 決定) |
| name | 名稱(小明教練 / 房間A) |
| photo | 照片 |
| color | 週曆顯示顏色 |
| is_active | 停用 = 離職/房間維修 |
| gcal_calendar_id | 公司為此資源建立的 Google 行事曆 ID(P7) |

### availability_rules(開放時間,每週重複)
| 欄位 | 說明 |
|---|---|
| id | |
| resource_id | **每個資源各自的開放時段** |
| weekday | 週幾 |
| start_time / end_time | 開放時段 |

### date_overrides(特殊日期:國定假日 / 公休 / 請假 / 加開)⭐
| 欄位 | 說明 |
|---|---|
| id | |
| date | 特定日期 |
| resource_id | **可空 = 全店**(國定假日、公休);指定 = 單一資源(教練請假、房間維修) |
| type | closed(整天休)/ special_hours(改時段)/ extra_open(加開) |
| start_time / end_time | type 為 special_hours / extra_open 時使用 |
| reason | 顯示用(春節、颱風、請假…) |

> **國定假日處理**:每年把台灣政府行政機關辦公日曆表(公開資料)匯入成全店 date_overrides,老闆再逐日調整(例:國定假日照常營業但改短時段、或加開)。優先權:date_overrides > availability_rules。

### slots(實際時段;模式 A 用,由 rules × 課程時長生成)
| 欄位 | 說明 |
|---|---|
| id | |
| course_id | |
| resource_id | 屬於哪個資源 |
| starts_at / ends_at | |
| capacity | 該堂容量 |
| booked_count | 已確認人數(防超賣關鍵) |

### booking_requests(預約)
| 欄位 | 說明 |
|---|---|
| id | |
| client_id | FK → clients |
| booking_id | 對外公開碼(例 BK-20260630-A1B2),也是回查憑證 |
| status | pending / approved / rejected / cancelled / completed |
| course_id | 服務項目 |
| resource_id | **確定後的資源**(模式 A approve 時填入;模式 B 建立時即有) |
| starts_at / ends_at | **確定後的時間範圍**(同上;模式 B 的防重疊檢查靠這兩欄) |
| note | 客人備註 |
| notify_channel / notified_at | 通知記錄 |
| gcal_event_id | 資源行事曆事件(P7) |
| company_gcal_event_id | 公司總行事曆事件(P7) |

> **兩模式殊途同歸**:模式 A 走 request_slots 多志願,approve 時把選定 slot 的 resource/時間寫回本表;模式 B 直接寫本表(status 即 approved)。之後的「我的預約、通知、提醒、取消、Google Calendar」全部共用。

### request_slots(申請 ↔ 多個志願時段)
| 欄位 | 說明 |
|---|---|
| request_id | FK → booking_requests |
| slot_id | FK → slots |
| preference_order | 志願序(1、2、3…) |

---

## 6. 核心預約流程

> 每店在 `shop.config.ts` 選 **booking_mode: "request"(申請制)或 "instant"(即時制)**。

### 模式 B:即時制(自助 gym / pilates / yoga 房間)
```
客人選 服務項目(定義時長 30/45/60)→ 選房間(或不限)→ 選起始時間(15/30 分格)
   → 手機必填,比對/建立 client → transaction 檢查該資源該時間範圍無重疊
   → 直接 approved 占位 + booking_id + 「已確認」通知
```
- 可用性動態計算:開放時間(rules + date_overrides)− 已有預約,**不預生成 slots**。
- 房間 capacity = 1(整間包下)。

### 模式 A:申請制(雪板課、有教練的課程店)
```
學生填表(選課程 + 勾多個志願時段,手機必填)
   → 用手機號比對 clients(有→沿用 client_id;無→新建)
   → 產生 booking_id
   → 狀態 pending,立即發「已收到」通知(含 booking_id)
        ↓
老闆後台看到申請(含各志願的即時餘額)
   → 按「確認這個志願」
        → 容量檢查(booked_count < capacity?)
        → transaction:booked_count +1、狀態 approved、其餘志願釋放
        → 發「已確認」通知;(P7)寫入 Google Calendar
   → 或「拒絕」→ 狀態 rejected,可附原因 + 通知
```

**關鍵**:approve 當下才占位 + 做 transaction，防止兩人同搶最後一位造成超賣。

### Admin 手動建立預約(電話 / LINE 私訊 / walk-in)
現實中很多客人用電話或私訊約課。老闆可在後台**直接建立預約**:
選時段 → 填姓名 + 手機(同樣走 clients 歸戶)→ 直接 approved 占位(不走 pending)。

### 取消 / 改期
- **先做最簡版(P4)**:學生聯絡店家,老闆在後台取消 → `booked_count -1`、狀態 cancelled、發通知、(P7)刪 Google 事件。
- **學生自助取消(P6)**:用手機 + booking_id 進「我的預約」自行取消;受**取消政策**限制(開課前 N 小時內不可取消,N 放 `shop.config.ts`,每店可設)。
- **改期** = 取消 + 重新預約(不做原地改期,邏輯最單純)。老闆後台可代客改期(取消舊的 + 手動建新的)。

### Slot 產生策略(模式 A)
- 排程**每天自動往前滾動生成 4 週**的 slots(rules × 課程時長,**套用 date_overrides**:closed 不生、special_hours 改生、extra_open 加生)。
- 老闆修改開放時間 / 新增 date_override → 只重生「未來且無人預約」的 slots;已有預約的 slot 不動,列出衝突讓老闆手動處理。
- 排程用 Vercel Cron(免費額度內)。

### 資源請假 / 臨時停用(教練請假、房間維修)
- 老闆後台對某資源新增 date_override(closed / special_hours)。
- 若該範圍**已有預約** → 系統列出受影響清單,老闆逐筆處理:取消(退款/通知)或代客改期。
- 與「修改開放時間」共用同一套衝突處理邏輯(P5 一起做)。

### 國定假日
- 每年匯入台灣政府辦公日曆 → 產生全店 date_overrides(預設 closed),老闆可逐日改成照常營業 / 特別時段 / 加開。
- 週曆上特殊日期顯示標記(例:「春節休」)。

---

## 7. 畫面(8 個)

### 客人端
1. **週曆 Timetable**(唯讀,RWD)
   - 視角 A:整店總覽(所有資源疊在一起,用顏色區分)
   - 視角 B:單一資源(某位教練 / 某間房的一週)
   - 🟢有位 / 🔴已滿 / ⚪休息;特殊日期顯示標記(春節休…);模式 A 顯示 `已約/總數`
   - 手機:一次一天、左右滑
2. **預約表單**
   - 模式 A:① 選課程 → ② 勾**多個**心儀時段(只列有位的,自動標志願序)→ ③ 填姓名+手機(Email 選填)
   - 模式 B:① 選服務(時長 30/45/60)→ ② 選房間(或不限)+ 起始時間 → ③ 填姓名+手機 → 立即確認
   - 登入時自動帶入資料
3. **送出狀態頁** — 顯示志願 + 「等待確認」+ booking_id(可截圖/回查)
4. **我的預約** — 即將到來 / 已完成清單
   - 登入 → 直接看;未登入 → 手機 + booking_id 進入

### 老闆端(需登入)
5. **申請審核** — 看學生多志願 + 各志願即時餘額,一鍵確認/拒絕(含容量檢查);可**手動建立預約**(電話/walk-in 客人)、取消/代客改期
6. **課程 + 開放時間 + 資源管理** — 改服務時長/容量/價格、每週開放時段、資源(教練/房間:顏色、停用、連 Google)、**特殊日期管理**(國定假日匯入、公休、請假/維修 + 受影響預約的衝突處理)
7. **客戶管理** — 客戶清單 + 點進看單一客戶的 session 清單(admin 視角)
8. **登入 / 註冊頁** — 客戶與 admin 登入(依 role 導向)

---

## 8. 通知設計

| 管道 | 接法 | 備註 |
|---|---|---|
| **Email** | Resend | 必做,每月幾千封內免費 |
| **WhatsApp** | WhatsApp Business API / Twilio | 按則收費(每則約幾毛~一塊) |
| **LINE** | LINE Messaging API(官方帳號) | 有免費額度;主動推播需對方先加好友 |

- 開啟哪些管道 → `shop.config.ts`(每店可不同)。
- 客戶可選 `preferred_channel`;手機號因三管道都可能用到,**一律必填**。
- 通知時機:
  1. 送出時(已收到 + booking_id)
  2. admin 確認 / 拒絕時
  3. 取消時
  4. **上課前一天自動提醒**(P6,Vercel Cron 排程;減少 no-show 最有效的功能)

---

## 9. Google Calendar 整合(P7,單向推送)

模型:**公司一個 Google 帳號(Service Account)擁有所有行事曆,教練只唯讀訂閱。**(泛化後 = 每個資源一本;房間型資源不需分享給任何人,純供老闆總覽)

```
公司 Service Account(唯一一組憑證)
   ├── 擁有:教練-小明 行事曆 → 分享(唯讀)給小明
   ├── 擁有:教練-阿華 行事曆 → 分享(唯讀)給阿華
   └── 擁有:公司總行事曆       → 老闆訂閱(永遠看全部)
```

- 系統用公司憑證即可寫進上述任一本(都是它擁有的)。
- 確認預約 → 寫「教練那本」+「公司總本」,各存 event_id;改期/取消 → 用 event_id 更新/刪除。
- **優點**:不需每位教練 OAuth;token 不會因人員異動失效;**新增/離職不用改任何訂閱**。
- 單向(系統 → 行事曆),不讀教練私人行程。
- 設定放 `.env`:`GOOGLE_SERVICE_ACCOUNT_KEY`、`COMPANY_GCAL_ID`。
- 注意:Service Account 建立/擁有行事曆在 Google Workspace 帳號下最穩。

---

## 10. 分階段開發

| 階段 | 內容 |
|---|---|
| **P1 地基** | Supabase schema(8 張表,含 resources / date_overrides)+ 雪板店 demo 種子資料 |
| **P2 週曆** | Timetable 唯讀(整店 / 單一資源視角)、RWD、特殊日期標記 |
| **P3 預約(模式 A)** | 報名表單(多志願)+ 比對/建立 client + 送出 pending + 狀態頁 |
| **P4 後台核心** | Supabase Auth(admin 登入)+ 審核 + 容量檢查 + booking_id + Email 通知 + **admin 手動建預約 / 取消**(流程閉環) |
| **P5 客戶 + 設定** | 客戶登入/註冊 + 「我的預約」+ 課程/資源/開放時間後台 + **特殊日期管理(假日匯入、請假/維修 + 衝突處理)** + 客戶管理 + `shop.config.ts` 抽離(template 化) |
| **P6 打磨** | 主色客製、手機打磨、**上課前提醒**、**客人自助取消(含取消政策)**、(選配)WhatsApp / LINE 通知 |
| **P7 行事曆** | Google Calendar 單向推送(資源本 + 公司總本) |
| **P8 即時制(模式 B)** | 起始時間 + 時長的即時預約、動態可用性計算、防重疊 transaction → 套用到自助 gym / pilates / yoga 店(此時金流優先級提高) |

---

## 11. 開發流程(subagent 分工)

每個階段(P1–P8)的開發一律走 **developer / reviewer 雙 subagent** 流程:

```
1. developer subagent  → 依 PLAN.md 實作該階段功能
2. reviewer subagent   → 獨立 review(正確性、防超賣/防重疊邏輯、schema 一致性、RWD)
3. reviewer 發現問題   → developer 修正 → 再 review,通過才算完成該階段
```

- Agent 定義放 `.claude/agents/developer.md` 與 `.claude/agents/reviewer.md`。
- reviewer 只讀不寫(read-only),確保 review 獨立性;修正一律回到 developer 做。
- 特別要求 reviewer 盯:transaction 防超賣(模式 A)、時間範圍防重疊(模式 B)、時區 `Asia/Taipei`、date_overrides 優先權。

## 12. 設計規範(UI/UX)

兩份文件,developer 實作與 reviewer 審查都必須遵守:

1. **Base theme**:全域 skill `sage-theme-uiux`(`~/.claude/skills/sage-theme-uiux/SKILL.md`)
   - Sage Theme A335:淡雅、自然、高級感;配色 60-30-10、字體階層、按鈕/卡片/表單樣式。
   - 定位:**template 預設主題**(最適合 yoga/pilates/gym);每店靠 CSS variables 換主色(雪板店換藍),排版與中性色規則不變。
2. **Booking 延伸規範**:[docs/design/booking-ui-extensions.md](docs/design/booking-ui-extensions.md)
   - Base theme 沒覆蓋的場景:週曆 grid、**狀態語意色 token**(有位/已滿/待確認/休息,全 template 統一、不可覆寫)、志願選擇 chips、狀態 badge、admin 高密度表格、衝突警示、手機單日檢視。
   - **衝突時以延伸規範為準**(功能辨識優先於淡雅);資源色只做色條/圓點,狀態色才做填色。

## 13. 待實作時再定的細節

- ORM:Prisma 或 Supabase client(P1 決定)。
- 金流(若要線上收費):綠界 ECPay / 藍新 NewebPay / LINE Pay(P6 之後)。
- 防濫用(免登入):手機格式驗證;必要時加簡訊 OTP 或圖形驗證。
- Cloudflare:之後若要 CDN/防護再加(選配,免費)。
- 手機號歸戶的邊界情況:同一手機幫多位家人約課(初期同一 client 即可;日後可加「上課人姓名」欄位)。
- 候補名單(waitlist):滿堂時排隊遞補(日後視需要)。
- 課程包 / 堂數卡(買 10 堂慢慢上):台灣課程店常見,牽涉付款 + 扣堂,等訂位流程跑順再加。
- 報到 / no-show 標記:上完課標記出席,豐富客戶紀錄(初期用備註即可)。
- 資料匯出 CSV:老闆拉報表用(半天工,要用再加)。
- 自助設施門禁(智慧鎖 / 密碼):**範圍外**;初期用 booking_id 出示 / 固定密碼解決。
- 模式 B 的金流(無人設施通常要先付款才算訂到):P8 時評估綠界等。
