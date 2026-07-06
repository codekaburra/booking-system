import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase client 工廠。
 *
 * 注意:env 缺失時「不在 module top-level throw」,只在實際取用 client
 * 時才報錯 —— 讓專案在尚未接真實 Supabase 時仍可 build。
 */

function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`缺少環境變數 ${name},請參考 .env.example 設定。`);
  }
  return value;
}

let browserClient: SupabaseClient | null = null;

/**
 * 瀏覽器端 client(anon key)。
 * 之後(P4+)開 RLS policy 後,前端唯讀查詢走這個。
 */
export function getSupabaseBrowserClient(): SupabaseClient {
  if (!browserClient) {
    browserClient = createClient(
      requireEnv(
        "NEXT_PUBLIC_SUPABASE_URL",
        process.env.NEXT_PUBLIC_SUPABASE_URL,
      ),
      requireEnv(
        "NEXT_PUBLIC_SUPABASE_ANON_KEY",
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      ),
    );
  }
  return browserClient;
}

/**
 * Server 端 client(service role key,繞過 RLS)。
 * 只能在 Server Component / Route Handler / Server Action 使用;
 * 每次呼叫回傳新實例,不快取 session。
 */
export function getSupabaseServerClient(): SupabaseClient {
  if (typeof window !== "undefined") {
    throw new Error(
      "getSupabaseServerClient 只能在 server 端使用(service role key 不可外洩到瀏覽器)。",
    );
  }
  return createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
    requireEnv(
      "SUPABASE_SERVICE_ROLE_KEY",
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    ),
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}
