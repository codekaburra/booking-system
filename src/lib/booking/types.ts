/**
 * 模式 A 預約流程共用型別(P3)。
 * server 端查資料組成 view model → 傳給 client 表單元件(client 不自行查 DB)。
 */

/** 可預約時段(未來 + 有空位 + 課程相符),已展開成顯示所需欄位 */
export interface BookableSlot {
  slotId: string;
  courseId: string;
  resourceId: string;
  resourceName: string;
  /** 資源色(色條/圓點用,不做狀態填色) */
  resourceColor: string | null;
  /** "YYYY-MM-DD"(台北當地日期,分組用) */
  date: string;
  /** "7/9(四)" */
  dayLabel: string;
  /** "14:00–16:00" */
  timeLabel: string;
  /** 台北當日分鐘數(排序用) */
  startMin: number;
  capacity: number;
  booked: number;
}

/** 課程(表單步驟①用;精簡 Course 顯示欄位) */
export interface BookableCourse {
  id: string;
  name: string;
  durationMin: number;
  capacity: number;
  price: number;
}

/** 送出表單的輸入(client → server action;server 端會重新驗證) */
export interface CreateBookingInput {
  courseId: string;
  /** 已選 slot id,依志願序排列(index 0 = 第一志願) */
  slotIds: string[];
  name: string;
  /** 使用者原始輸入(server 端 normalize) */
  phone: string;
  email?: string;
  note?: string;
}

/** createBooking 成功回傳 */
export interface CreateBookingResult {
  bookingId: string;
  /** demo 模式為 true(未實際寫入 DB) */
  demo: boolean;
}

/** 單一志願摘要(狀態頁顯示用) */
export interface BookingPreference {
  /** 志願序 1、2、3… */
  order: number;
  /** "7/9(四)" */
  dayLabel: string;
  /** "14:00–16:00" */
  timeLabel: string;
  resourceName: string;
  resourceColor: string | null;
}

/** 送出成功後的摘要(狀態頁顯示;demo 模式由送出結果直接帶入,不回查) */
export interface BookingSummary {
  name: string;
  courseName: string;
  preferences: BookingPreference[];
}
