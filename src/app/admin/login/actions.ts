"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DEMO_ADMIN_COOKIE } from "@/lib/auth/admin";
import { hasSupabaseEnv } from "@/lib/data";
import { createAuthClient } from "@/lib/supabase/server-auth";

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!hasSupabaseEnv()) {
    return { ok: false as const, message: "示範模式請使用「進入示範後台」" };
  }

  const supabase = await createAuthClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false as const, message: "帳號或密碼錯誤" };

  const role = data.user?.app_metadata?.role;
  if (role !== "admin") {
    await supabase.auth.signOut();
    return { ok: false as const, message: "此帳號無管理員權限" };
  }

  redirect("/admin/inbox");
}

export async function demoLoginAction() {
  if (hasSupabaseEnv()) {
    throw new Error("已設定 Supabase,請使用管理員帳密登入");
  }
  const jar = await cookies();
  jar.set(DEMO_ADMIN_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  redirect("/admin/inbox");
}

export async function logoutAction() {
  if (hasSupabaseEnv()) {
    const supabase = await createAuthClient();
    await supabase.auth.signOut();
  } else {
    const jar = await cookies();
    jar.delete(DEMO_ADMIN_COOKIE);
  }
  redirect("/admin/login");
}
