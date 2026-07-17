"use client";

/**
 * 分店選擇器(前台;PLAN.md §14)。
 *
 * - 值 = 分店 slug,選擇後寫 cookie(server action),整站 RSC 重新以該分店查資料。
 * - **單一分店的事業不會渲染這個元件**(見 site-chrome:branches.length <= 1 → 隱藏),
 *   顧客不必多按一次。
 * - 高度 44px(touch target);顏色全走 CSS variables。
 */

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { selectBranchAction } from "@/app/branch-actions";

export function BranchSelect({
  branches,
  selectedSlug,
}: {
  branches: { slug: string; name: string }[];
  selectedSlug: string | null;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      ref={formRef}
      action={async (fd) => {
        await selectBranchAction(fd);
        startTransition(() => router.refresh());
      }}
      className="flex items-center gap-1.5"
    >
      <label htmlFor="branch-select" className="sr-only">
        選擇分店
      </label>
      <select
        id="branch-select"
        name="branch"
        defaultValue={selectedSlug ?? ""}
        disabled={pending}
        onChange={() => formRef.current?.requestSubmit()}
        className="h-11 max-w-40 rounded-lg border border-border bg-surface px-2 text-sm text-text focus:outline-2 focus:outline-primary disabled:opacity-60 sm:max-w-none sm:px-3"
      >
        {branches.map((b) => (
          <option key={b.slug} value={b.slug}>
            {b.name}
          </option>
        ))}
      </select>
      {/* 無 JS 時的後援:select 的 onChange 送不出去,仍可按這顆切換 */}
      <noscript>
        <button
          type="submit"
          className="h-11 rounded-lg border border-border px-3 text-sm"
        >
          切換
        </button>
      </noscript>
    </form>
  );
}
