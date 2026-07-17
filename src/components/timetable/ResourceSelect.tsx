"use client";

/**
 * 視角切換 dropdown:分店總覽 / 單一資源(教練/房間…)。
 * 以 searchParams(?resource=)驅動,server component 重新查詢渲染。
 * options 只會是**目前分店**的資源(由 /timetable 依 branchId 查出後傳入)。
 */

import { useRouter } from "next/navigation";

export function ResourceSelect({
  options,
  selectedId,
  week,
  view = "week",
  label,
}: {
  options: { id: string; name: string }[];
  selectedId: string | null;
  week: string;
  /** 目前檢視;切到單一資源時只有週檢視,故僅在回到總覽時保留 */
  view?: "week" | "day";
  label: string;
}) {
  const router = useRouter();

  return (
    <select
      aria-label={`選擇${label}`}
      value={selectedId ?? ""}
      onChange={(e) => {
        const v = e.target.value;
        const params = new URLSearchParams({ week });
        if (v) params.set("resource", v);
        else if (view === "day") params.set("view", "day");
        router.push(`/timetable?${params.toString()}`);
      }}
      className="h-11 rounded-lg border border-border bg-surface px-3 text-sm text-text focus:outline-2 focus:outline-primary"
    >
      <option value="">全部{label}</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.name}
        </option>
      ))}
    </select>
  );
}
