"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DEMO_CLIENT_COOKIE } from "@/lib/auth/client";
import { hasSupabaseEnv } from "@/lib/data";
import { getClientDataSource } from "@/lib/data/client";
import { createAuthClient } from "@/lib/supabase/server-auth";
import { normalizePhone } from "@/lib/booking/phone";
import { isAdminUser } from "@/lib/auth/admin";

export async function clientLoginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!hasSupabaseEnv()) {
    return { ok: false as const, message: "示範模式請使用手機號登入" };
  }

  const supabase = await createAuthClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false as const, message: "帳號或密碼錯誤" };
  if (isAdminUser(data.user)) {
    await supabase.auth.signOut();
    return { ok: false as const, message: "請使用管理員登入頁" };
  }

  redirect("/my-bookings");
}

export async function clientSignupAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!name) return { ok: false as const, message: "請填寫姓名" };
  if (!normalizePhone(phone)) return { ok: false as const, message: "手機號格式不正確" };
  if (!email) return { ok: false as const, message: "請填寫電子郵件" };
  if (password.length < 6) return { ok: false as const, message: "密碼至少 6 碼" };

  if (!hasSupabaseEnv()) {
    return { ok: false as const, message: "示範模式請使用手機號登入" };
  }

  const supabase = await createAuthClient();
  const { data: signUp, error: signErr } = await supabase.auth.signUp({ email, password });
  if (signErr) return { ok: false as const, message: signErr.message };

  const userId = signUp.user?.id;
  if (!userId) return { ok: false as const, message: "註冊失敗" };

  const ds = await getClientDataSource();
  await ds.linkOrCreateClient(userId, name, phone, email);
  redirect("/my-bookings");
}

export async function demoClientLoginAction(formData: FormData) {
  if (hasSupabaseEnv()) {
    throw new Error("已設定 Supabase,請使用電子郵件登入");
  }
  const phone = String(formData.get("phone") ?? "").trim();
  const normalized = normalizePhone(phone);
  if (!normalized) return { ok: false as const, message: "手機號格式不正確" };

  const ds = await getClientDataSource();
  const client = await ds.findClientByPhone(normalized);
  if (!client) {
    return {
      ok: false as const,
      message: "找不到此手機的客戶資料。可先送出預約或聯絡店家建立帳戶。",
    };
  }

  const jar = await cookies();
  jar.set(DEMO_CLIENT_COOKIE, client.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  redirect("/my-bookings");
}

export async function clientLogoutAction() {
  if (hasSupabaseEnv()) {
    const supabase = await createAuthClient();
    await supabase.auth.signOut();
  } else {
    const jar = await cookies();
    jar.delete(DEMO_CLIENT_COOKIE);
  }
  redirect("/login");
}

export async function lookupBookingAction(formData: FormData) {
  const bookingId = String(formData.get("bookingId") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const ds = await getClientDataSource();
  const booking = await ds.getBookingByCode(bookingId, phone);
  if (!booking) {
    return { ok: false as const, message: "查無此預約,請確認查詢碼與手機號" };
  }
  return { ok: true as const, booking };
}
