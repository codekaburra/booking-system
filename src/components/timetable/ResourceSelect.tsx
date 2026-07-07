"use client";

/**
 * 視角切換 dropdown:整店總覽 / 單一資源(教練/房間…)。
 * 以 searchParams(?resource=)驅動,server component 重新查詢渲染。
 */

import { useRouter } from "next/navigation";

export function ResourceSelect({
  options,
  selectedId,
  week,
  label,
}: {
  options: { id: string; name: string }[];
  selectedId: string | null;
  week: string;
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
        router.push(`/timetable?${params.toString()}`);
      }}
      className="h-11 rounded-lg border border-border bg-surface px-3 text-sm text-text focus:outline-2 focus:outline-primary"
    >
      <option value="">整店總覽</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.name}
        </option>
      ))}
    </select>
  );
}
