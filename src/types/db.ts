/**
 * 資料表 TS 型別(手寫,與 supabase/migrations/0001_init.sql 一致)。
 * 8 張表:clients、courses、resources、availability_rules、
 * date_overrides、slots、booking_requests、request_slots(PLAN.md §5)。
 *
 * 時間欄位:
 * - timestamptz → ISO 8601 字串(UTC 儲存;顯示一律轉 Asia/Taipei)
 * - date        → "YYYY-MM-DD"
 * - time        → "HH:MM:SS"
 */

export type NotifyChannel = "email" | "whatsapp" | "line";
export type ResourceType = "instructor" | "room" | "equipment";
export type DateOverrideType = "closed" | "special_hours" | "extra_open";
export type BookingStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "cancelled"
  | "completed";

/** 客戶(手機號必填且唯一,用來歸戶) */
export interface Client {
  id: string;
  name: string;
  /** 必填、唯一;同手機 = 同一人 */
  phone: string;
  email: string | null;
  line_user_id: string | null;
  preferred_channel: NotifyChannel;
  /** 登入後綁 Supabase Auth user;訪客為 null */
  auth_user_id: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

/** 課程 / 服務項目 */
export interface Course {
  id: string;
  name: string;
  /** 上課時長(分鐘) */
  duration_min: number;
  /** 每堂容納人數(1 = 私人;8 = 團體) */
  capacity: number;
  /** 價格(新台幣元) */
  price: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** 可預約資源:教練 / 房間 / 器材(介面稱呼由 shop.config.ts 決定) */
export interface Resource {
  id: string;
  type: ResourceType;
  name: string;
  photo: string | null;
  /** 週曆顯示顏色(hex;只用於色條/圓點,不做狀態填色) */
  color: string | null;
  /** 停用 = 離職 / 房間維修 */
  is_active: boolean;
  /** 公司為此資源建立的 Google 行事曆 ID(P7) */
  gcal_calendar_id: string | null;
  created_at: string;
  updated_at: string;
}

/** 開放時間(每週重複;每個資源各自的開放時段) */
export interface AvailabilityRule {
  id: string;
  resource_id: string;
  /** 0 = 週日 … 6 = 週六(同 JS Date.getDay()) */
  weekday: number;
  start_time: string;
  end_time: string;
  created_at: string;
}

/** 特殊日期:國定假日 / 公休 / 請假 / 加開(優先權 > availability_rules) */
export interface DateOverride {
  id: string;
  /** "YYYY-MM-DD"(Asia/Taipei 當地日期) */
  date: string;
  /** null = 全店(國定假日、公休);指定 = 單一資源(請假、維修) */
  resource_id: string | null;
  type: DateOverrideType;
  /** type 為 special_hours / extra_open 時必填 */
  start_time: string | null;
  end_time: string | null;
  /** 顯示用(春節、颱風、請假…) */
  reason: string | null;
  created_at: string;
}

/** 實際時段(模式 A 用;由 rules × 課程時長生成) */
export interface Slot {
  id: string;
  course_id: string;
  resource_id: string;
  starts_at: string;
  ends_at: string;
  capacity: number;
  /** 已確認人數(防超賣關鍵:approve 時 transaction 檢查 booked_count < capacity) */
  booked_count: number;
  created_at: string;
  updated_at: string;
}

/** 預約(兩模式共用;模式 A 走 request_slots 多志願,模式 B 直接寫本表) */
export interface BookingRequest {
  id: string;
  client_id: string;
  /** 對外公開碼(例 BK-20260630-A1B2),也是回查憑證 */
  booking_id: string;
  status: BookingStatus;
  course_id: string;
  /** 確定後的資源(模式 A approve 時填入;模式 B 建立時即有) */
  resource_id: string | null;
  /** 確定後的時間範圍(模式 B 防重疊檢查靠這兩欄) */
  starts_at: string | null;
  ends_at: string | null;
  note: string | null;
  notify_channel: NotifyChannel | null;
  notified_at: string | null;
  /** 資源行事曆事件(P7) */
  gcal_event_id: string | null;
  /** 公司總行事曆事件(P7) */
  company_gcal_event_id: string | null;
  created_at: string;
  updated_at: string;
}

/** 申請 ↔ 多個志願時段(模式 A) */
export interface RequestSlot {
  request_id: string;
  slot_id: string;
  /** 志願序(1、2、3…) */
  preference_order: number;
}

/** 8 張表總覽(之後可換成 supabase gen types 產生的 Database 型別) */
export interface Tables {
  clients: Client;
  courses: Course;
  resources: Resource;
  availability_rules: AvailabilityRule;
  date_overrides: DateOverride;
  slots: Slot;
  booking_requests: BookingRequest;
  request_slots: RequestSlot;
}
