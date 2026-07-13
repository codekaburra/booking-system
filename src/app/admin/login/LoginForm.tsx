"use client";

import { useState } from "react";
import { loginAction } from "./actions";

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const fd = new FormData(e.currentTarget);
    const res = await loginAction(fd);
    if (res?.ok === false) setError(res.message ?? "登入失敗");
    setPending(false);
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-6"
    >
      {error && (
        <p className="text-sm text-status-full-strong" role="alert">
          {error}
        </p>
      )}
      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className="rounded-lg border border-border bg-bg px-3 py-2.5 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-sm font-medium">
          密碼
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          className="rounded-lg border border-border bg-bg px-3 py-2.5 text-sm"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-primary py-2.5 text-sm font-medium text-surface hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "登入中…" : "登入"}
      </button>
    </form>
  );
}
