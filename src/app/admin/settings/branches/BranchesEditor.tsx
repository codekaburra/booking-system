"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Branch } from "@/types/db";
import { createBranchAction, updateBranchAction } from "../actions";

export function BranchesEditor({ branches }: { branches: Branch[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function create(fd: FormData) {
    const res = await createBranchAction(fd);
    setError(res.ok ? null : res.message);
    if (res.ok) router.refresh();
  }

  async function update(fd: FormData) {
    const res = await updateBranchAction(fd);
    setError(res.ok ? null : res.message);
    if (res.ok) router.refresh();
  }

  return (
    <div className="mt-4 flex flex-col gap-4">
      {error && (
        <p className="rounded-lg border border-status-full/40 bg-status-full/10 px-3 py-2 text-sm text-status-full-strong">
          {error}
        </p>
      )}

      {branches.map((b) => (
        <form
          key={b.id}
          action={update}
          className={`rounded-xl border border-border bg-surface p-4 ${b.is_active ? "" : "opacity-60"}`}
        >
          <input type="hidden" name="id" value={b.id} />
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{b.name}</span>
            {!b.is_active && (
              <span className="inline-flex rounded-full border border-border px-2 py-0.5 text-xs text-muted">
                已停用
              </span>
            )}
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              分店名稱
              <input
                name="name"
                defaultValue={b.name}
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
            </label>
            <label className="text-sm">
              識別碼(slug)
              <input
                name="slug"
                defaultValue={b.slug}
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 font-mono text-sm"
              />
            </label>
            <label className="text-sm sm:col-span-2">
              地址
              <input
                name="address"
                defaultValue={b.address ?? ""}
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
            </label>
            <label className="text-sm">
              排序
              <input
                name="sort_order"
                type="number"
                defaultValue={b.sort_order}
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input name="is_active" type="checkbox" defaultChecked={b.is_active} />
              啟用(取消勾選 = 停用,前台不再顯示)
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

      <form
        action={create}
        className="rounded-xl border border-dashed border-border bg-surface p-4"
      >
        <h2 className="text-sm font-medium">新增分店</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            分店名稱
            <input
              name="name"
              required
              placeholder="例:高雄店"
              className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm">
            識別碼(slug)
            <input
              name="slug"
              required
              placeholder="例:kaohsiung"
              className="mt-1 w-full rounded-lg border border-border px-3 py-2 font-mono text-sm"
            />
          </label>
          <label className="text-sm sm:col-span-2">
            地址
            <input
              name="address"
              className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm">
            排序
            <input
              name="sort_order"
              type="number"
              defaultValue={0}
              className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
            />
          </label>
        </div>
        <button
          type="submit"
          className="mt-3 rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-surface"
        >
          新增
        </button>
      </form>
    </div>
  );
}
