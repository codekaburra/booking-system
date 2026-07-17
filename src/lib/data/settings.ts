/**
 * 後台設定資料層(P5) — 課程、資源、開放時間、特殊日期、resource_courses。
 */

import "server-only";

import type {
  AvailabilityRule,
  BookingRequest,
  Branch,
  Client,
  Course,
  DateOverride,
  Resource,
} from "@/types/db";
import { hasSupabaseEnv } from "@/lib/data";
import { getSupabaseServerClient } from "@/lib/supabase";
import {
  availabilityRules,
  branches,
  buildDateOverrides,
  courses,
  resourceCourseLinks,
  resources,
} from "@/lib/data/demo-generator";
import { demoClients, demoRequests, demoSlots } from "@/lib/data/demo-store";
import { addDays, taipeiToday } from "@/lib/tz";

export interface AffectedBooking {
  bookingId: string;
  clientName: string;
  courseName: string;
  timeLabel: string;
  status: BookingRequest["status"];
}

export interface SettingsDataSource {
  /** 全部分店(含停用;後台 Branches CRUD 用)依 sort_order → name */
  getAllBranches(): Promise<Branch[]>;
  /** 課程為**共用型錄**,不分店 → 無 branchId 參數 */
  getAllCourses(): Promise<Course[]>;
  updateCourse(
    id: string,
    patch: Partial<Pick<Course, "name" | "duration_min" | "capacity" | "price" | "is_active">>,
  ): Promise<void>;
  /** branchId 給值則只回該分店的資源(省略 = 全事業) */
  getAllResources(branchId?: string): Promise<Resource[]>;
  updateResource(
    id: string,
    patch: Partial<Pick<Resource, "name" | "color" | "is_active">>,
  ): Promise<void>;
  getAvailabilityRules(resourceId: string): Promise<AvailabilityRule[]>;
  upsertAvailabilityRule(
    resourceId: string,
    weekday: number,
    startTime: string,
    endTime: string,
    id?: string,
  ): Promise<void>;
  deleteAvailabilityRule(id: string): Promise<void>;
  getDateOverrides(from: string, to: string, branchId?: string): Promise<DateOverride[]>;
  /**
   * 建立特殊日期。
   * - resourceId 有值 → 分店由該資源推導(branchId 給了也必須一致,否則 DB trigger 擋)
   * - resourceId 省略 → 「該分店全店」,**branchId 必填**(舊語意的「全店」已不存在)
   */
  createDateOverride(input: {
    date: string;
    branchId?: string;
    resourceId?: string;
    type: DateOverride["type"];
    startTime?: string;
    endTime?: string;
    reason?: string;
  }): Promise<void>;
  deleteDateOverride(id: string): Promise<void>;
  getResourceCourseIds(resourceId: string): Promise<string[]>;
  setResourceCourses(resourceId: string, courseIds: string[]): Promise<void>;
  /** branchId 給值則只看該分店的受影響預約(分店級公休 → 只影響該分店) */
  getAffectedBookings(
    date: string,
    resourceId?: string | null,
    branchId?: string,
  ): Promise<AffectedBooking[]>;
  /** 客戶**全事業共用**,不分店 */
  getAllClients(): Promise<Client[]>;
  getClientBookings(clientId: string): Promise<BookingRequest[]>;
  /**
   * 國定假日匯入:**每間啟用分店各寫一列**(PLAN.md §14)。
   * 回傳實際新增的列數(跨所有分店合計);已存在的略過。
   */
  importTaiwanHolidays(year: number): Promise<number>;
}

/**
 * 解出一筆 date_override 該掛在哪一間分店(supabase / demo 共用):
 *   1. 明給 branchId → 用它
 *   2. 否則有 resourceId → 取該資源的分店(0005 的 trigger 也會這樣帶,這裡先算出來
 *      是為了讓「分店級」與「資源級」走同一條路徑,且 demo 端沒有 trigger 可靠)
 *   3. 都沒有 → 第一間啟用分店
 *
 * TODO(branches-ui): Pass 2 的後台特殊日期頁會讓老闆明確選分店,屆時第 3 種情況
 * (預設分店)應該消失 —— 它只是為了讓 Pass 1 既有呼叫端不必改就能編譯 / 運作。
 */
async function resolveOverrideBranchId(
  ds: SettingsDataSource,
  input: { branchId?: string; resourceId?: string },
): Promise<string> {
  if (input.branchId) return input.branchId;
  if (input.resourceId) {
    const resource = (await ds.getAllResources()).find(
      (r) => r.id === input.resourceId,
    );
    if (!resource) throw new Error("resource_not_found");
    return resource.branch_id;
  }
  const branch = (await ds.getAllBranches()).find((b) => b.is_active);
  if (!branch) throw new Error("no_active_branch");
  return branch.id;
}

// --- Supabase ----------------------------------------------------------------

const supabaseSettings: SettingsDataSource = {
  async getAllBranches() {
    const { data, error } = await getSupabaseServerClient()
      .from("branches")
      .select("*")
      .order("sort_order")
      .order("name");
    if (error) throw new Error(error.message);
    return (data ?? []) as Branch[];
  },

  async getAllCourses() {
    const { data, error } = await getSupabaseServerClient()
      .from("courses")
      .select("*")
      .order("name");
    if (error) throw new Error(error.message);
    return (data ?? []) as Course[];
  },

  async updateCourse(id, patch) {
    const { error } = await getSupabaseServerClient()
      .from("courses")
      .update(patch)
      .eq("id", id);
    if (error) throw new Error(error.message);
  },

  async getAllResources(branchId) {
    let q = getSupabaseServerClient().from("resources").select("*");
    if (branchId) q = q.eq("branch_id", branchId);
    const { data, error } = await q.order("name");
    if (error) throw new Error(error.message);
    return (data ?? []) as Resource[];
  },

  async updateResource(id, patch) {
    const { error } = await getSupabaseServerClient()
      .from("resources")
      .update(patch)
      .eq("id", id);
    if (error) throw new Error(error.message);
  },

  async getAvailabilityRules(resourceId) {
    const { data, error } = await getSupabaseServerClient()
      .from("availability_rules")
      .select("*")
      .eq("resource_id", resourceId)
      .order("weekday");
    if (error) throw new Error(error.message);
    return (data ?? []) as AvailabilityRule[];
  },

  async upsertAvailabilityRule(resourceId, weekday, startTime, endTime, id) {
    const row = {
      resource_id: resourceId,
      weekday,
      start_time: startTime.length === 5 ? `${startTime}:00` : startTime,
      end_time: endTime.length === 5 ? `${endTime}:00` : endTime,
    };
    if (id) {
      const { error } = await getSupabaseServerClient()
        .from("availability_rules")
        .update(row)
        .eq("id", id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await getSupabaseServerClient()
        .from("availability_rules")
        .insert(row);
      if (error) throw new Error(error.message);
    }
  },

  async deleteAvailabilityRule(id) {
    const { error } = await getSupabaseServerClient()
      .from("availability_rules")
      .delete()
      .eq("id", id);
    if (error) throw new Error(error.message);
  },

  async getDateOverrides(from, to, branchId) {
    let q = getSupabaseServerClient()
      .from("date_overrides")
      .select("*")
      .gte("date", from)
      .lte("date", to);
    if (branchId) q = q.eq("branch_id", branchId);
    const { data, error } = await q.order("date");
    if (error) throw new Error(error.message);
    return (data ?? []) as DateOverride[];
  },

  async createDateOverride(input) {
    const branchId = await resolveOverrideBranchId(this, input);
    const { error } = await getSupabaseServerClient().from("date_overrides").insert({
      date: input.date,
      branch_id: branchId,
      resource_id: input.resourceId ?? null,
      type: input.type,
      start_time:
        input.type === "closed"
          ? null
          : input.startTime
            ? input.startTime.length === 5
              ? `${input.startTime}:00`
              : input.startTime
            : null,
      end_time:
        input.type === "closed"
          ? null
          : input.endTime
            ? input.endTime.length === 5
              ? `${input.endTime}:00`
              : input.endTime
            : null,
      reason: input.reason ?? null,
    });
    if (error) throw new Error(error.message);
  },

  async deleteDateOverride(id) {
    const { error } = await getSupabaseServerClient()
      .from("date_overrides")
      .delete()
      .eq("id", id);
    if (error) throw new Error(error.message);
  },

  async getResourceCourseIds(resourceId) {
    const { data, error } = await getSupabaseServerClient()
      .from("resource_courses")
      .select("course_id")
      .eq("resource_id", resourceId);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => r.course_id as string);
  },

  async setResourceCourses(resourceId, courseIds) {
    const sb = getSupabaseServerClient();
    const { error: delErr } = await sb
      .from("resource_courses")
      .delete()
      .eq("resource_id", resourceId);
    if (delErr) throw new Error(delErr.message);
    if (courseIds.length === 0) return;
    const { error } = await sb.from("resource_courses").insert(
      courseIds.map((course_id) => ({ resource_id: resourceId, course_id })),
    );
    if (error) throw new Error(error.message);
  },

  async getAffectedBookings(date, resourceId, branchId) {
    const dayStart = `${date}T00:00:00+08:00`;
    const dayEnd = `${addDays(date, 1)}T00:00:00+08:00`;
    let q = getSupabaseServerClient()
      .from("booking_requests")
      .select("*")
      .in("status", ["pending", "approved"])
      .not("starts_at", "is", null)
      .gte("starts_at", dayStart)
      .lt("starts_at", dayEnd);
    if (resourceId) q = q.eq("resource_id", resourceId);
    // 分店級公休只影響該分店的預約(資源級已隱含分店 → 兩者可並用)
    if (branchId) q = q.eq("branch_id", branchId);

    const { data: reqs, error } = await q;
    if (error) throw new Error(error.message);
    if (!reqs?.length) return [];

    const clientIds = [...new Set(reqs.map((r) => r.client_id))];
    const courseIds = [...new Set(reqs.map((r) => r.course_id))];
    const [{ data: clients }, { data: courseRows }] = await Promise.all([
      getSupabaseServerClient().from("clients").select("*").in("id", clientIds),
      getSupabaseServerClient().from("courses").select("*").in("id", courseIds),
    ]);
    const clientMap = new Map((clients ?? []).map((c) => [c.id, c as Client]));
    const courseMap = new Map((courseRows ?? []).map((c) => [c.id, c as Course]));

    return (reqs as BookingRequest[]).map((r) => ({
      bookingId: r.booking_id,
      clientName: clientMap.get(r.client_id)?.name ?? "—",
      courseName: courseMap.get(r.course_id)?.name ?? "—",
      timeLabel: r.starts_at
        ? new Date(r.starts_at).toLocaleString("zh-TW", {
            timeZone: "Asia/Taipei",
            month: "numeric",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          })
        : "—",
      status: r.status,
    }));
  },

  async getAllClients() {
    const { data, error } = await getSupabaseServerClient()
      .from("clients")
      .select("*")
      .order("name");
    if (error) throw new Error(error.message);
    return (data ?? []) as Client[];
  },

  async getClientBookings(clientId) {
    const { data, error } = await getSupabaseServerClient()
      .from("booking_requests")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as BookingRequest[];
  },

  async importTaiwanHolidays(year) {
    const holidays = taiwanHolidaysForYear(year);
    // 全事業假日 = 每間**啟用**分店各一列(0005 起「全店」的語意是「該分店全店」)
    const activeBranches = (await this.getAllBranches()).filter((b) => b.is_active);
    let count = 0;
    for (const branch of activeBranches) {
      for (const h of holidays) {
        const { error } = await getSupabaseServerClient().from("date_overrides").upsert(
          {
            date: h.date,
            branch_id: branch.id,
            resource_id: null,
            type: "closed",
            start_time: null,
            end_time: null,
            reason: h.reason,
          },
          // 唯一鍵在 0005 改為 (branch_id, date, resource_id, type)
          { onConflict: "branch_id,date,resource_id,type", ignoreDuplicates: true },
        );
        if (!error) count += 1;
      }
    }
    return count;
  },
};

// --- Demo (in-memory copies) -------------------------------------------------

const DEMO_TODAY = taipeiToday();
let demoRules = [...availabilityRules];
let demoOverrides = buildDateOverrides(DEMO_TODAY);
let demoResourceCourses = resourceCourseLinks.map((l) => ({ ...l }));
let ruleSeq = demoRules.length;

const demoSettings: SettingsDataSource = {
  async getAllBranches() {
    return [...branches].sort(
      (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name),
    );
  },

  async getAllCourses() {
    return [...courses];
  },

  async updateCourse(id, patch) {
    const c = courses.find((x) => x.id === id);
    if (!c) throw new Error("not_found");
    Object.assign(c, patch);
    c.updated_at = new Date().toISOString();
  },

  async getAllResources(branchId) {
    return resources.filter((r) => !branchId || r.branch_id === branchId);
  },

  async updateResource(id, patch) {
    const r = resources.find((x) => x.id === id);
    if (!r) throw new Error("not_found");
    Object.assign(r, patch);
    r.updated_at = new Date().toISOString();
  },

  async getAvailabilityRules(resourceId) {
    return demoRules.filter((r) => r.resource_id === resourceId);
  },

  async upsertAvailabilityRule(resourceId, weekday, startTime, endTime, id) {
    const start_time = startTime.length === 5 ? `${startTime}:00` : startTime;
    const end_time = endTime.length === 5 ? `${endTime}:00` : endTime;
    if (id) {
      const rule = demoRules.find((r) => r.id === id);
      if (!rule) throw new Error("not_found");
      rule.weekday = weekday;
      rule.start_time = start_time;
      rule.end_time = end_time;
    } else {
      ruleSeq += 1;
      demoRules.push({
        id: `66666666-6666-4666-8666-${String(ruleSeq).padStart(12, "0")}`,
        resource_id: resourceId,
        weekday,
        start_time,
        end_time,
        created_at: new Date().toISOString(),
      });
    }
  },

  async deleteAvailabilityRule(id) {
    demoRules = demoRules.filter((r) => r.id !== id);
  },

  async getDateOverrides(from, to, branchId) {
    return demoOverrides.filter(
      (o) =>
        o.date >= from &&
        o.date <= to &&
        (!branchId || o.branch_id === branchId),
    );
  },

  async createDateOverride(input) {
    const branchId = await resolveOverrideBranchId(this, input);
    const id = `77777777-7777-4777-8777-${String(demoOverrides.length + 1).padStart(12, "0")}`;
    demoOverrides.push({
      id,
      date: input.date,
      branch_id: branchId,
      resource_id: input.resourceId ?? null,
      type: input.type,
      start_time:
        input.type === "closed"
          ? null
          : input.startTime
            ? input.startTime.length === 5
              ? `${input.startTime}:00`
              : input.startTime
            : null,
      end_time:
        input.type === "closed"
          ? null
          : input.endTime
            ? input.endTime.length === 5
              ? `${input.endTime}:00`
              : input.endTime
            : null,
      reason: input.reason ?? null,
      created_at: new Date().toISOString(),
    });
  },

  async deleteDateOverride(id) {
    demoOverrides = demoOverrides.filter((o) => o.id !== id);
  },

  async getResourceCourseIds(resourceId) {
    return demoResourceCourses
      .filter((l) => l.resource_id === resourceId)
      .map((l) => l.course_id);
  },

  async setResourceCourses(resourceId, courseIds) {
    demoResourceCourses = demoResourceCourses.filter((l) => l.resource_id !== resourceId);
    for (const course_id of courseIds) {
      demoResourceCourses.push({ resource_id: resourceId, course_id });
    }
  },

  async getAffectedBookings(date, resourceId, branchId) {
    const dayStart = new Date(`${date}T00:00:00+08:00`).getTime();
    const dayEnd = new Date(`${addDays(date, 1)}T00:00:00+08:00`).getTime();
    return demoRequests
      .filter((r) => {
        if (!["pending", "approved"].includes(r.status) || !r.starts_at) return false;
        const t = new Date(r.starts_at).getTime();
        if (t < dayStart || t >= dayEnd) return false;
        if (branchId && r.branch_id !== branchId) return false;
        if (resourceId && r.resource_id !== resourceId) return false;
        if (!resourceId && r.resource_id) return true;
        return true;
      })
      .map((r) => {
        const client = demoClients.find((c) => c.id === r.client_id);
        const course = courses.find((c) => c.id === r.course_id);
        return {
          bookingId: r.booking_id,
          clientName: client?.name ?? "—",
          courseName: course?.name ?? "—",
          timeLabel: r.starts_at
            ? new Date(r.starts_at).toLocaleString("zh-TW", {
                timeZone: "Asia/Taipei",
                month: "numeric",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              })
            : "—",
          status: r.status,
        };
      });
  },

  async getAllClients() {
    return [...demoClients];
  },

  async getClientBookings(clientId) {
    return demoRequests.filter((r) => r.client_id === clientId);
  },

  async importTaiwanHolidays(year) {
    const holidays = taiwanHolidaysForYear(year);
    const activeBranches = (await this.getAllBranches()).filter((b) => b.is_active);
    let count = 0;
    for (const branch of activeBranches) {
      for (const h of holidays) {
        const exists = demoOverrides.some(
          (o) =>
            o.date === h.date &&
            o.branch_id === branch.id &&
            o.resource_id === null &&
            o.type === "closed",
        );
        if (exists) continue;
        await this.createDateOverride({
          date: h.date,
          branchId: branch.id,
          type: "closed",
          reason: h.reason,
        });
        count += 1;
      }
    }
    return count;
  },
};

function taiwanHolidaysForYear(year: number): { date: string; reason: string }[] {
  if (year === 2026) {
    return [
      { date: "2026-01-01", reason: "元旦" },
      { date: "2026-02-16", reason: "春節" },
      { date: "2026-02-17", reason: "春節" },
      { date: "2026-02-18", reason: "春節" },
      { date: "2026-02-19", reason: "春節" },
      { date: "2026-02-20", reason: "春節" },
      { date: "2026-02-27", reason: "和平紀念日補假" },
      { date: "2026-04-03", reason: "兒童節連假" },
      { date: "2026-04-04", reason: "兒童節" },
      { date: "2026-04-05", reason: "清明節" },
      { date: "2026-04-06", reason: "清明節連假" },
      { date: "2026-05-01", reason: "勞動節" },
      { date: "2026-06-19", reason: "端午節" },
      { date: "2026-09-25", reason: "中秋節" },
      { date: "2026-10-09", reason: "國慶日補假" },
      { date: "2026-10-10", reason: "國慶日" },
    ];
  }
  return [];
}

export async function getSettingsDataSource(): Promise<SettingsDataSource> {
  if (hasSupabaseEnv()) return supabaseSettings;
  return demoSettings;
}

// demo timetable reads overrides from demo-generator module — sync on read via getDateOverrides in demo.ts
void demoSlots;
