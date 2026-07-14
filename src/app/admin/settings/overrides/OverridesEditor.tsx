"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { DateOverride, Resource } from "@/types/db";
import {
  checkAffectedAction,
  createOverrideAction,
  deleteOverrideAction,
  importHolidaysAction,
} from "../actions";
import type { AffectedBooking } from "@/lib/data/settings";

const TYPE_LABEL: Record<DateOverride["type"], string> = {
  closed: "公休 / 請假",
  special_hours: "特殊營業",
  extra_open: "加開",
};

interface Props {
  overrides: DateOverride[];
  resources: Resource[];
}

export function OverridesEditor({ overrides, resources }: Props) {
  const router = useRouter();
  const [affected, setAffected] = useState<AffectedBooking[] | null>(null);
  const [type, setType] = useState<DateOverride["type"]>("closed");

  async function checkAffected(fd: FormData) {
    const res = await checkAffectedAction(fd);
    if (res.ok) setAffected(res.affected);
  }

  return (
    <div className="flex flex-col gap-6">
      <form
        action={async (fd) => {
          const res = await importHolidaysAction(fd);
          if (res.ok) router.refresh();
        }}
        className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-surface p-4"
      >
        <label className="text-sm">
          匯入台灣國定假日
          <input
            name="year"
            type="number"
            defaultValue={2026}
            className="mt-1 block rounded-lg border border-border px-3 py-2 text-sm"
          />
        </label>
        <button
          type="submit"
          className="rounded-full bg-primary px-4 py-2 text-xs font-medium text-surface"
        >
          匯入(全店公休)
        </button>
      </form>

      <form
        action={async (fd) => {
          await createOverrideAction(fd);
          router.refresh();
        }}
        className="rounded-xl border border-border bg-surface p-4"
      >
        <h2 className="text-sm font-medium">新增特殊日期</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            日期
            <input name="date" type="date" required className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm" />
          </label>
          <label className="text-sm">
            類型
            <select
              name="type"
              value={type}
              onChange={(e) => setType(e.target.value as DateOverride["type"])}
              className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
            >
              <option value="closed">公休 / 請假</option>
              <option value="special_hours">特殊營業</option>
              <option value="extra_open">加開</option>
            </select>
          </label>
          <label className="text-sm sm:col-span-2">
            資源(留空 = 全店)
            <select name="resource_id" className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm">
              <option value="">全店</option>
              {resources.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          {type !== "closed" && (
            <>
              <label className="text-sm">
                開始
                <input name="start_time" type="time" required className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm" />
              </label>
              <label className="text-sm">
                結束
                <input name="end_time" type="time" required className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm" />
              </label>
            </>
          )}
          <label className="text-sm sm:col-span-2">
            說明
            <input name="reason" className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm" placeholder="春節、請假…" />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="submit" className="rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-surface">
            新增
          </button>
        </div>
      </form>

      <form action={checkAffected} className="rounded-xl border border-status-pending/40 bg-status-pending/10 p-4">
        <h2 className="text-sm font-medium">衝突檢查</h2>
        <p className="mt-1 text-xs text-muted">新增請假/公休前,先查看當日既有預約。</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <input name="date" type="date" required className="rounded-lg border border-border px-3 py-2 text-sm" />
          <select name="resource_id" className="rounded-lg border border-border px-3 py-2 text-sm">
            <option value="">全店</option>
            {resources.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <button type="submit" className="rounded-full border border-border px-4 py-2 text-xs">
            檢查
          </button>
        </div>
        {affected && (
          <ul className="mt-3 text-sm">
            {affected.length === 0 ? (
              <li className="text-muted">此日無受影響的預約。</li>
            ) : (
              affected.map((a) => (
                <li key={a.bookingId} className="border-t border-border py-2">
                  {a.bookingId} · {a.clientName} · {a.courseName} · {a.timeLabel} ({a.status})
                </li>
              ))
            )}
          </ul>
        )}
      </form>

      <section>
        <h2 className="text-sm font-medium text-muted">已設定</h2>
        <ul className="mt-3 flex flex-col gap-2">
          {overrides.length === 0 ? (
            <li className="rounded-xl border border-border p-4 text-center text-sm text-muted">
              尚無特殊日期
            </li>
          ) : (
            overrides.map((o) => (
              <li
                key={o.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-surface px-4 py-3 text-sm"
              >
                <span>
                  {o.date} · {TYPE_LABEL[o.type]}
                  {o.resource_id
                    ? ` · ${resources.find((r) => r.id === o.resource_id)?.name ?? ""}`
                    : " · 全店"}
                  {o.reason ? ` · ${o.reason}` : ""}
                  {o.start_time && o.end_time
                    ? ` · ${o.start_time.slice(0, 5)}–${o.end_time.slice(0, 5)}`
                    : ""}
                </span>
                <form
                  action={async (fd) => {
                    await deleteOverrideAction(fd);
                    router.refresh();
                  }}
                >
                  <input type="hidden" name="id" value={o.id} />
                  <button type="submit" className="text-xs text-status-full-strong">
                    刪除
                  </button>
                </form>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
