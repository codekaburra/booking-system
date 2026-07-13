"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { InboxItem } from "@/lib/admin/types";
import {
  approveRequestAction,
  cancelRequestAction,
  rejectRequestAction,
} from "../actions";

interface Props {
  items: InboxItem[];
  mode: "pending" | "approved";
}

export function InboxList({ items, mode }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(
    key: string,
    fn: () => Promise<{ ok: boolean; message?: string }>,
  ) {
    setBusy(key);
    setError(null);
    try {
      const res = await fn();
      if (!res.ok) setError(res.message ?? "操作失敗");
      else router.refresh();
    } finally {
      setBusy(null);
    }
  }

  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-surface p-6 text-center text-sm text-muted">
        {mode === "pending" ? "目前沒有待處理的申請。" : "目前沒有已確認的預約。"}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-status-full/40 bg-status-full/10 px-4 py-3 text-sm text-status-full-strong"
        >
          {error}
        </div>
      )}

      {items.map((item) => (
        <article
          key={item.requestId}
          className="rounded-xl border border-border bg-surface p-4 sm:p-5"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    mode === "pending"
                      ? "bg-status-pending/20 text-status-pending-strong"
                      : "bg-status-available/20 text-status-available-strong"
                  }`}
                >
                  {mode === "pending" ? "待確認" : "已確認"}
                </span>
                <span className="font-mono text-sm">{item.bookingId}</span>
              </div>
              <p className="mt-2 text-sm font-medium">
                {item.clientName} · {item.courseName}
              </p>
              <p className="text-xs text-muted">
                {item.clientPhone}
                {item.clientEmail ? ` · ${item.clientEmail}` : ""}
              </p>
              {item.unreachable && mode === "pending" && (
                <p className="mt-1 text-xs font-medium text-status-full-strong">
                  ⚠ 無法通知 — 請電話聯絡客戶
                </p>
              )}
              {item.note && (
                <p className="mt-2 text-xs text-muted">備註:{item.note}</p>
              )}
            </div>
            {mode === "pending" && (
              <button
                type="button"
                disabled={busy === `reject-${item.requestId}`}
                onClick={() =>
                  act(`reject-${item.requestId}`, () =>
                    rejectRequestAction(item.requestId, "時段無法安排"),
                  )
                }
                className="rounded-full border border-border px-4 py-2 text-xs text-muted hover:border-status-full hover:text-status-full-strong disabled:opacity-50"
              >
                拒絕
              </button>
            )}
          </div>

          {mode === "pending" ? (
            <div className="mt-4 flex flex-col gap-2">
              <p className="text-xs font-medium text-muted">志願時段</p>
              <div className="flex flex-col gap-2">
                {item.preferences.map((p) => (
                  <div
                    key={p.slotId}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-bg px-3 py-2.5"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-surface">
                        {p.order}
                      </span>
                      <span
                        aria-hidden
                        className="h-6 w-1 shrink-0 rounded-full"
                        style={{ background: p.resourceColor ?? "var(--color-muted)" }}
                      />
                      <span className="text-sm">
                        {p.dayLabel} {p.timeLabel} · {p.resourceName}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs ${
                          p.available
                            ? "text-status-available-strong"
                            : "text-status-full-strong"
                        }`}
                      >
                        {p.available
                          ? `餘 ${p.capacity - p.booked}/${p.capacity}`
                          : "已額滿"}
                      </span>
                      <button
                        type="button"
                        disabled={!p.available || busy === `approve-${p.slotId}`}
                        onClick={() =>
                          act(`approve-${p.slotId}`, () =>
                            approveRequestAction(item.requestId, p.slotId),
                          )
                        }
                        className="rounded-full bg-status-available px-4 py-1.5 text-xs font-medium text-surface hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        ✓ 確認
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            item.preferences[0] && (
              <p className="mt-3 text-sm">
                {item.preferences[0].dayLabel} {item.preferences[0].timeLabel} ·{" "}
                {item.preferences[0].resourceName}
              </p>
            )
          )}

          {mode === "approved" && (
            <button
              type="button"
              className="mt-3 rounded-full border border-status-full/40 px-4 py-1.5 text-xs text-status-full-strong hover:bg-status-full/10 disabled:opacity-50"
              disabled={busy === `cancel-${item.requestId}`}
              onClick={() =>
                act(`cancel-${item.requestId}`, () =>
                  cancelRequestAction(item.requestId, "老闆取消"),
                )
              }
            >
              取消此預約
            </button>
          )}
        </article>
      ))}
    </div>
  );
}
