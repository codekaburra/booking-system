"use client";

import { useState } from "react";
import { formatTwMobile } from "@/lib/booking/phone";
import {
  clientLoginAction,
  clientSignupAction,
  demoClientLoginAction,
} from "./actions";

interface Props {
  demoMode: boolean;
}

const inputClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text " +
  "focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40";

export function LoginForm({ demoMode }: Props) {
  const [tab, setTab] = useState<"login" | "signup">("login");
  const [error, setError] = useState<string | null>(null);
  const [phone, setPhone] = useState("");

  async function handle(
    fn: (fd: FormData) => Promise<{ ok: boolean; message?: string } | void>,
    fd: FormData,
  ) {
    setError(null);
    const res = await fn(fd);
    if (res && "ok" in res && !res.ok) setError(res.message ?? "失敗");
  }

  if (demoMode) {
    return (
      <div className="mx-auto w-full max-w-md">
        <h1 className="font-serif text-2xl font-medium">會員登入</h1>
        <p className="mt-1 text-sm text-muted">
          示範模式:以種子資料客戶手機登入(例 0912-345-678 王小美)。
        </p>
        <form
          action={(fd) => handle(demoClientLoginAction, fd)}
          className="mt-6 flex flex-col gap-4 rounded-xl border border-border bg-surface p-5"
        >
          {error && (
            <p role="alert" className="text-sm text-status-full-strong">
              {error}
            </p>
          )}
          <label className="flex flex-col gap-1 text-sm">
            手機號
            <input
              name="phone"
              type="tel"
              required
              className={inputClass}
              value={phone}
              onChange={(e) => setPhone(formatTwMobile(e.target.value))}
              placeholder="09xx-xxx-xxx"
            />
          </label>
          <button
            type="submit"
            className="rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-surface hover:opacity-90"
          >
            登入
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <h1 className="font-serif text-2xl font-medium">會員登入</h1>
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={() => setTab("login")}
          className={`rounded-full px-4 py-1.5 text-sm ${
            tab === "login" ? "bg-primary text-surface" : "border border-border text-text"
          }`}
        >
          登入
        </button>
        <button
          type="button"
          onClick={() => setTab("signup")}
          className={`rounded-full px-4 py-1.5 text-sm ${
            tab === "signup" ? "bg-primary text-surface" : "border border-border text-text"
          }`}
        >
          註冊
        </button>
      </div>

      {tab === "login" ? (
        <form
          action={(fd) => handle(clientLoginAction, fd)}
          className="mt-6 flex flex-col gap-4 rounded-xl border border-border bg-surface p-5"
        >
          {error && (
            <p role="alert" className="text-sm text-status-full-strong">
              {error}
            </p>
          )}
          <label className="flex flex-col gap-1 text-sm">
            電子郵件
            <input name="email" type="email" required className={inputClass} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            密碼
            <input name="password" type="password" required className={inputClass} />
          </label>
          <button
            type="submit"
            className="rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-surface hover:opacity-90"
          >
            登入
          </button>
        </form>
      ) : (
        <form
          action={(fd) => handle(clientSignupAction, fd)}
          className="mt-6 flex flex-col gap-4 rounded-xl border border-border bg-surface p-5"
        >
          {error && (
            <p role="alert" className="text-sm text-status-full-strong">
              {error}
            </p>
          )}
          <label className="flex flex-col gap-1 text-sm">
            姓名
            <input name="name" required className={inputClass} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            手機號
            <input
              name="phone"
              type="tel"
              required
              className={inputClass}
              placeholder="09xx-xxx-xxx"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            電子郵件
            <input name="email" type="email" required className={inputClass} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            密碼
            <input name="password" type="password" required minLength={6} className={inputClass} />
          </label>
          <button
            type="submit"
            className="rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-surface hover:opacity-90"
          >
            註冊
          </button>
        </form>
      )}
    </div>
  );
}
