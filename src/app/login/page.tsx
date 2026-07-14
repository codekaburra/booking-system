import type { Metadata } from "next";
import Link from "next/link";
import { shopConfig } from "@/config/shop.config";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { hasSupabaseEnv } from "@/lib/data";
import { getClientSession } from "@/lib/auth/client";
import { redirect } from "next/navigation";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: `${shopConfig.name}|會員登入`,
};

export default async function LoginPage() {
  const session = await getClientSession();
  if (session) redirect("/my-bookings");

  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader active="/login" />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
        <LoginForm demoMode={!hasSupabaseEnv()} />
        <p className="mx-auto mt-6 max-w-md text-center text-xs text-muted">
          店家管理員請至{" "}
          <Link href="/admin/login" className="text-primary hover:underline">
            管理後台登入
          </Link>
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
