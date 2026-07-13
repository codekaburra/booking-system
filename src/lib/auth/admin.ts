import "server-only";

import { cookies } from "next/headers";
import { hasSupabaseEnv } from "@/lib/data";
import { createAuthClient } from "@/lib/supabase/server-auth";

export const DEMO_ADMIN_COOKIE = "demo_admin_session";

export interface AdminSession {
  /** demo 模式為 true */
  demo: boolean;
  email: string;
}

/** 是否為 admin(role = app_metadata.role === 'admin') */
export function isAdminUser(user: {
  app_metadata?: Record<string, unknown>;
}): boolean {
  return user.app_metadata?.role === "admin";
}

/**
 * 取得目前 admin session;未登入回 null。
 * - 有 Supabase env:驗證 Supabase Auth session + admin role
 * - demo 模式:驗證 demo_admin_session cookie
 */
export async function getAdminSession(): Promise<AdminSession | null> {
  if (hasSupabaseEnv()) {
    const supabase = await createAuthClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !isAdminUser(user)) return null;
    return { demo: false, email: user.email ?? "admin" };
  }

  const jar = await cookies();
  if (jar.get(DEMO_ADMIN_COOKIE)?.value === "1") {
    return { demo: true, email: "demo@admin" };
  }
  return null;
}

/** 未登入則 throw(供 server action 使用) */
export async function requireAdmin(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) throw new Error("unauthorized");
  return session;
}
