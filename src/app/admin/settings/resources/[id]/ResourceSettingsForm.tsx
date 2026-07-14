"use client";

import { useRouter } from "next/navigation";
import type { AvailabilityRule, Course, Resource } from "@/types/db";
import {
  addAvailabilityRuleAction,
  deleteAvailabilityRuleAction,
  saveResourceCoursesAction,
  updateResourceAction,
} from "../../actions";

const WEEKDAYS = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"];

interface Props {
  resource: Resource;
  courses: Course[];
  selectedCourseIds: string[];
  rules: AvailabilityRule[];
}

export function ResourceSettingsForm({
  resource,
  courses,
  selectedCourseIds,
  rules,
}: Props) {
  const router = useRouter();

  return (
    <div className="flex flex-col gap-8">
      <form
        action={async (fd) => {
          await updateResourceAction(fd);
          router.refresh();
        }}
        className="rounded-xl border border-border bg-surface p-4"
      >
        <input type="hidden" name="id" value={resource.id} />
        <h2 className="text-sm font-medium">基本資料</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            名稱
            <input
              name="name"
              defaultValue={resource.name}
              className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm">
            顯示顏色
            <input
              name="color"
              type="color"
              defaultValue={resource.color ?? "#6b9bb5"}
              className="mt-1 h-10 w-full rounded-lg border border-border"
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input name="is_active" type="checkbox" defaultChecked={resource.is_active} />
            啟用
          </label>
        </div>
        <button
          type="submit"
          className="mt-3 rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-surface"
        >
          儲存
        </button>
      </form>

      <form
        action={async (fd) => {
          await saveResourceCoursesAction(fd);
          router.refresh();
        }}
        className="rounded-xl border border-border bg-surface p-4"
      >
        <input type="hidden" name="resourceId" value={resource.id} />
        <h2 className="text-sm font-medium">可開課程</h2>
        <p className="mt-1 text-xs text-muted">P6 時段生成依此對映表。</p>
        <ul className="mt-3 flex flex-col gap-2">
          {courses.map((c) => (
            <li key={c.id}>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="courseId"
                  value={c.id}
                  defaultChecked={selectedCourseIds.includes(c.id)}
                />
                {c.name}
              </label>
            </li>
          ))}
        </ul>
        <button
          type="submit"
          className="mt-3 rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-surface"
        >
          儲存課程對映
        </button>
      </form>

      <section className="rounded-xl border border-border bg-surface p-4">
        <h2 className="text-sm font-medium">每週開放時間</h2>
        <ul className="mt-3 flex flex-col gap-2">
          {rules.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm"
            >
              <span>
                {WEEKDAYS[r.weekday]} {r.start_time.slice(0, 5)}–{r.end_time.slice(0, 5)}
              </span>
              <form
                action={async (fd) => {
                  await deleteAvailabilityRuleAction(fd);
                  router.refresh();
                }}
              >
                <input type="hidden" name="id" value={r.id} />
                <input type="hidden" name="resourceId" value={resource.id} />
                <button type="submit" className="text-xs text-status-full-strong">
                  刪除
                </button>
              </form>
            </li>
          ))}
        </ul>
        <form
          action={async (fd) => {
            await addAvailabilityRuleAction(fd);
            router.refresh();
          }}
          className="mt-4 grid gap-2 sm:grid-cols-4"
        >
          <input type="hidden" name="resourceId" value={resource.id} />
          <select name="weekday" className="rounded-lg border border-border px-2 py-2 text-sm">
            {WEEKDAYS.map((label, i) => (
              <option key={i} value={i}>
                {label}
              </option>
            ))}
          </select>
          <input
            name="start_time"
            type="time"
            required
            className="rounded-lg border border-border px-2 py-2 text-sm"
          />
          <input
            name="end_time"
            type="time"
            required
            className="rounded-lg border border-border px-2 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded-full border border-border px-3 py-2 text-xs hover:border-primary"
          >
            新增時段
          </button>
        </form>
      </section>
    </div>
  );
}
