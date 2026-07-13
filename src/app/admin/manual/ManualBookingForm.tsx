"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatTwMobile, isValidTwMobile } from "@/lib/booking/phone";
import type { ManualSlotOption } from "@/lib/admin/types";
import { manualBookingAction } from "../actions";

interface Props {
  slots: ManualSlotOption[];
}

export function ManualBookingForm({ slots }: Props) {
  const router = useRouter();
  const [slotId, setSlotId] = useState(slots[0]?.slotId ?? "");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const selected = slots.find((s) => s.slotId === slotId);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!name.trim()) return setError("請填寫姓名");
    if (!isValidTwMobile(phone)) return setError("手機格式不正確");
    if (!slotId) return setError("請選擇時段");

    setSubmitting(true);
    try {
      const res = await manualBookingAction(
        slotId,
        name,
        phone,
        email.trim() || undefined,
        note.trim() || undefined,
      );
      if (!res.ok) {
        setError(res.message ?? "建立失敗");
        return;
      }
      setSuccess(`已建立預約 ${res.bookingId}`);
      setName("");
      setPhone("");
      setEmail("");
      setNote("");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  if (slots.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-surface p-6 text-sm text-muted">
        目前沒有可預約的未來時段。
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-lg flex-col gap-4">
      {error && (
        <p className="text-sm text-status-full-strong" role="alert">
          {error}
        </p>
      )}
      {success && (
        <p className="text-sm text-status-available-strong" role="status">
          {success}
        </p>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor="manual-slot" className="text-sm font-medium">
          時段
        </label>
        <select
          id="manual-slot"
          value={slotId}
          onChange={(e) => setSlotId(e.target.value)}
          className="rounded-lg border border-border bg-surface px-3 py-2.5 text-sm"
        >
          {slots.map((s) => (
            <option key={s.slotId} value={s.slotId}>
              {s.courseName} · {s.dayLabel} {s.timeLabel} · {s.resourceName}(餘{" "}
              {s.remaining})
            </option>
          ))}
        </select>
        {selected && (
          <p className="text-xs text-muted">
            將直接確認,不經過待審流程。
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="manual-name" className="text-sm font-medium">
          姓名
        </label>
        <input
          id="manual-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-lg border border-border bg-surface px-3 py-2.5 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="manual-phone" className="text-sm font-medium">
          手機
        </label>
        <input
          id="manual-phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(formatTwMobile(e.target.value))}
          className="rounded-lg border border-border bg-surface px-3 py-2.5 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="manual-email" className="text-sm font-medium">
          Email(選填)
        </label>
        <input
          id="manual-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-lg border border-border bg-surface px-3 py-2.5 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="manual-note" className="text-sm font-medium">
          備註(選填)
        </label>
        <textarea
          id="manual-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          className="rounded-lg border border-border bg-surface px-3 py-2.5 text-sm"
        />
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="rounded-full bg-primary py-2.5 text-sm font-medium text-surface hover:opacity-90 disabled:opacity-60"
      >
        {submitting ? "建立中…" : "建立並確認預約"}
      </button>
    </form>
  );
}
