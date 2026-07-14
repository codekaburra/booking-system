"use client";

/**
 * 模式 A 預約流程(client;設計規範 booking-ui-extensions §4/§5/§7)。
 *
 * 三步:① 選課程 → ② 勾多個志願時段(勾選順序=志願序,自動編號) → ③ 填資料。
 * client 端驗證僅為即時提示;送出後由 server action 再驗一次(server 權威)。
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { togglePreference } from "@/lib/booking/preferences";
import { formatTwMobile, isValidTwMobile } from "@/lib/booking/phone";
import type {
  BookableCourse,
  BookableSlot,
  CreateBookingInput,
} from "@/lib/booking/types";
import type { BookActionResult } from "./actions";
import { MonthPicker } from "./MonthPicker";

type Field = "name" | "phone" | "slots" | "course";

interface Props {
  courses: BookableCourse[];
  slotsByCourse: Record<string, BookableSlot[]>;
  channelLabel: string;
  /** 台北今天 "YYYY-MM-DD"(server 計算;月曆預設當月與過去日判斷用) */
  today: string;
  submit: (input: CreateBookingInput) => Promise<BookActionResult>;
  /** P5:已登入客戶自動帶入 */
  autofill?: { name: string; phone: string; email: string };
}

const inputClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text " +
  "focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40";

const stepMeta = [
  { n: 1, label: "選課程" },
  { n: 2, label: "選時段" },
  { n: 3, label: "填資料" },
] as const;

export function BookFlow({
  courses,
  slotsByCourse,
  channelLabel,
  today,
  submit,
  autofill,
}: Props) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [courseId, setCourseId] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [name, setName] = useState(autofill?.name ?? "");
  const [phone, setPhone] = useState(autofill?.phone ?? "");
  const [email, setEmail] = useState(autofill?.email ?? "");
  const [note, setNote] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<Field, string>>>(
    {},
  );
  const [banner, setBanner] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<BookActionResult | null>(null);

  const selectedCourse = courses.find((c) => c.id === courseId) ?? null;
  const courseSlots = courseId ? slotsByCourse[courseId] ?? [] : [];

  function pickCourse(id: string) {
    if (id !== courseId) {
      setCourseId(id);
      setSelected([]); // 課程換了,志願重置(不同課程 slots 不同)
    }
    setFieldErrors((e) => ({ ...e, course: undefined }));
    setStep(2);
  }

  function toggleSlot(slotId: string) {
    setSelected((prev) => togglePreference(prev, slotId));
    setFieldErrors((e) => ({ ...e, slots: undefined }));
    setBanner(null);
  }

  function phoneError(): string | undefined {
    if (fieldErrors.phone) return fieldErrors.phone;
    if (phone.trim() && !isValidTwMobile(phone)) {
      return "手機號碼格式不正確(09xx-xxx-xxx)";
    }
    return undefined;
  }

  async function onSubmit() {
    setBanner(null);
    // client 端即時檢查(server 仍會再驗)
    const errs: Partial<Record<Field, string>> = {};
    if (!name.trim()) errs.name = "請填寫姓名";
    if (!phone.trim()) errs.phone = "請填寫手機號碼";
    else if (!isValidTwMobile(phone)) errs.phone = "手機號碼格式不正確(09xx-xxx-xxx)";
    if (selected.length === 0) errs.slots = "請至少選擇一個志願時段";
    if (!courseId) errs.course = "請選擇課程";
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }

    setSubmitting(true);
    try {
      const res = await submit({
        courseId,
        slotIds: selected,
        name,
        phone,
        email: email.trim() || undefined,
        note: note.trim() || undefined,
      });

      if (res.ok) {
        setResult(res);
        // 網址反映 booking_id,方便截圖 / 分享(durable 頁見 /book/[bookingId])
        if (typeof window !== "undefined" && res.bookingId) {
          window.history.replaceState(null, "", `/book/${res.bookingId}`);
        }
        return;
      }

      // 失敗:分派錯誤到對應步驟
      if (res.fieldErrors?.length) {
        const map: Partial<Record<Field, string>> = {};
        for (const fe of res.fieldErrors) map[fe.field] = fe.message;
        setFieldErrors(map);
        if (map.course || map.slots) setStep(map.course ? 1 : 2);
      }
      if (res.unavailableSlotIds?.length) {
        // 剛剛額滿/過期的時段 → 取消勾選,回步驟 2,並刷新可預約清單
        setSelected((prev) =>
          prev.filter((id) => !res.unavailableSlotIds!.includes(id)),
        );
        setStep(2);
        router.refresh();
      }
      if (res.message) setBanner(res.message);
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setResult(null);
    setStep(1);
    setCourseId("");
    setSelected([]);
    setName("");
    setPhone("");
    setEmail("");
    setNote("");
    setFieldErrors({});
    setBanner(null);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", "/book");
    }
  }

  if (result?.ok && result.summary) {
    return (
      <SuccessView
        bookingId={result.bookingId!}
        demo={Boolean(result.demo)}
        summary={result.summary}
        channelLabel={channelLabel}
        onReset={reset}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 步驟指示 */}
      <ol className="flex items-center gap-2 text-xs sm:text-sm">
        {stepMeta.map((s, i) => {
          const active = step === s.n;
          const done = step > s.n;
          return (
            <li key={s.n} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  // 只能回到已完成的步驟
                  if (s.n < step) setStep(s.n as 1 | 2 | 3);
                }}
                disabled={s.n > step}
                className={`flex min-h-11 items-center gap-1.5 rounded-full px-3 py-2 ${
                  active
                    ? "bg-primary/15 font-medium text-primary"
                    : done
                      ? "text-text hover:text-primary"
                      : "text-muted"
                }`}
              >
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${
                    active || done
                      ? "bg-primary text-surface"
                      : "bg-border text-muted"
                  }`}
                >
                  {s.n}
                </span>
                {s.label}
              </button>
              {i < stepMeta.length - 1 && (
                <span aria-hidden className="text-muted">
                  ›
                </span>
              )}
            </li>
          );
        })}
      </ol>

      {banner && (
        <div
          role="alert"
          className="rounded-lg border border-status-full/40 bg-status-full/10 px-4 py-3 text-sm text-status-full-strong"
        >
          {banner}
        </div>
      )}

      {/* 步驟 ①:選課程 */}
      {step === 1 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-muted">① 選擇課程</h2>
          {fieldErrors.course && (
            <p className="text-sm text-status-full-strong">{fieldErrors.course}</p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {courses.map((c) => {
              const all = slotsByCourse[c.id] ?? [];
              const available = all.filter((s) => s.booked < s.capacity).length;
              const isSel = c.id === courseId;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => pickCourse(c.id)}
                  className={`flex flex-col items-start gap-1 rounded-xl border p-4 text-left transition ${
                    isSel
                      ? "border-primary bg-primary/10"
                      : "border-border bg-surface hover:border-primary/50"
                  }`}
                >
                  <span className="text-base font-medium">{c.name}</span>
                  <span className="text-xs text-muted">
                    {c.durationMin} 分鐘・容納 {c.capacity} 人・NT${c.price}
                  </span>
                  <span className="mt-1 text-xs text-muted">
                    {available > 0
                      ? `可預約時段 ${available} 個`
                      : all.length > 0
                        ? "目前全部額滿"
                        : "目前無可預約時段"}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* 步驟 ②:勾選志願時段 */}
      {step === 2 && (
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-muted">
              ② 勾選志願時段
              {selectedCourse && (
                <span className="ml-2 text-text">{selectedCourse.name}</span>
              )}
            </h2>
            <span className="text-xs text-muted">已選 {selected.length} 個</span>
          </div>
          <p className="text-xs text-muted">
            點月曆上有位的日期,勾選當日時段;可跨日跨月複選,勾選順序即為志願序(1、2、3…)。
          </p>
          {fieldErrors.slots && (
            <p className="text-sm text-status-full-strong">{fieldErrors.slots}</p>
          )}

          {courseSlots.length === 0 ? (
            <div className="flex min-h-24 items-center justify-center rounded-xl border border-border bg-surface p-6 text-sm text-muted">
              此課程目前沒有可預約的時段,請改選其他課程或查看週課表。
            </div>
          ) : (
            <MonthPicker
              slots={courseSlots}
              selected={selected}
              onToggle={toggleSlot}
              today={today}
            />
          )}

          <div className="flex items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="rounded-full border border-border bg-surface px-5 py-2.5 text-sm text-text hover:border-primary hover:text-primary"
            >
              上一步
            </button>
            <button
              type="button"
              disabled={selected.length === 0}
              onClick={() => setStep(3)}
              className="rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-surface transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              下一步(填資料)
            </button>
          </div>
        </section>
      )}

      {/* 步驟 ③:填資料 */}
      {step === 3 && (
        <section className="flex flex-col gap-4">
          <h2 className="text-sm font-medium text-muted">③ 填寫聯絡資料</h2>

          <div className="flex flex-col gap-1">
            <label htmlFor="bk-name" className="text-sm font-medium">
              姓名 <span className="text-status-full-strong">*</span>
            </label>
            <input
              id="bk-name"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setFieldErrors((x) => ({ ...x, name: undefined }));
              }}
              className={inputClass}
              autoComplete="name"
            />
            {fieldErrors.name && (
              <p className="text-xs text-status-full-strong">{fieldErrors.name}</p>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="bk-phone" className="text-sm font-medium">
              手機號碼 <span className="text-status-full-strong">*</span>
            </label>
            <input
              id="bk-phone"
              type="tel"
              inputMode="numeric"
              placeholder="0912-345-678"
              value={phone}
              onChange={(e) => {
                setPhone(formatTwMobile(e.target.value));
                setFieldErrors((x) => ({ ...x, phone: undefined }));
              }}
              className={inputClass}
              autoComplete="tel"
            />
            {phoneError() && (
              <p className="text-xs text-status-full-strong">{phoneError()}</p>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="bk-email" className="text-sm font-medium">
              電子郵件 <span className="text-muted">(選填)</span>
            </label>
            <input
              id="bk-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
              autoComplete="email"
            />
            <p className="text-xs text-muted">
              留下電子郵件可收到確認通知({channelLabel})。
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="bk-note" className="text-sm font-medium">
              備註 <span className="text-muted">(選填)</span>
            </label>
            <textarea
              id="bk-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className={inputClass}
            />
          </div>

          <div className="flex items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="rounded-full border border-border bg-surface px-5 py-2.5 text-sm text-text hover:border-primary hover:text-primary"
            >
              上一步
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={onSubmit}
              className="rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-surface transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "送出中…" : "送出預約申請"}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

function SuccessView({
  bookingId,
  demo,
  summary,
  channelLabel,
  onReset,
}: {
  bookingId: string;
  demo: boolean;
  summary: NonNullable<BookActionResult["summary"]>;
  channelLabel: string;
  onReset: () => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface p-6 text-center">
        <span className="inline-flex items-center rounded-full bg-status-pending/20 px-3 py-1 text-xs font-medium text-status-pending-strong">
          待確認
        </span>
        <p className="text-sm text-muted">預約申請已送出,請保存以下預約編號:</p>
        <p className="select-all font-mono text-2xl font-semibold tracking-widest sm:text-3xl">
          {bookingId}
        </p>
        <p className="text-sm">
          {summary.name} · {summary.courseName}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-muted">您的志願時段</h2>
        <ol className="flex flex-col gap-2">
          {summary.preferences.map((p) => (
            <li
              key={p.order}
              className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-surface">
                {p.order}
              </span>
              <span
                aria-hidden
                className="h-8 w-1 shrink-0 rounded-full"
                style={{ background: p.resourceColor ?? "var(--color-muted)" }}
              />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">
                  {p.dayLabel} {p.timeLabel}
                </span>
                <span className="block text-xs text-muted">{p.resourceName}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>

      <p className="rounded-lg border border-border bg-status-pending/10 px-4 py-3 text-sm leading-7 text-text">
        我們會盡快確認您的預約,確認結果將以 {channelLabel} 通知。
        請保留預約編號以便日後查詢。
      </p>

      {demo && (
        <p className="text-xs text-muted">
          目前為示範資料:此預約未實際成立,重新整理頁面後將無法再查詢此編號。
        </p>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={onReset}
          className="rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-surface transition hover:opacity-90"
        >
          再預約一筆
        </button>
        <Link
          href="/timetable"
          className="rounded-full border border-border bg-surface px-6 py-2.5 text-center text-sm text-text hover:border-primary hover:text-primary"
        >
          查看週課表
        </Link>
      </div>
    </div>
  );
}
