"use client";

import { useRouter } from "next/navigation";
import type { Course } from "@/types/db";
import { updateCourseAction } from "../actions";

export function CoursesEditor({ courses }: { courses: Course[] }) {
  const router = useRouter();

  async function save(fd: FormData) {
    await updateCourseAction(fd);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      {courses.map((c) => (
        <form
          key={c.id}
          action={save}
          className="rounded-xl border border-border bg-surface p-4"
        >
          <input type="hidden" name="id" value={c.id} />
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm sm:col-span-2">
              名稱
              <input
                name="name"
                defaultValue={c.name}
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
            </label>
            <label className="text-sm">
              時長(分)
              <input
                name="duration_min"
                type="number"
                min={1}
                defaultValue={c.duration_min}
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
            </label>
            <label className="text-sm">
              容量
              <input
                name="capacity"
                type="number"
                min={1}
                defaultValue={c.capacity}
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
            </label>
            <label className="text-sm">
              價格(元)
              <input
                name="price"
                type="number"
                min={0}
                defaultValue={c.price}
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input name="is_active" type="checkbox" defaultChecked={c.is_active} />
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
      ))}
    </div>
  );
}
