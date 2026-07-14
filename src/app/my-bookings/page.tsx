import type { Metadata } from "next";
import Link from "next/link";
import { shopConfig } from "@/config/shop.config";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { getClientSession } from "@/lib/auth/client";
import { getClientDataSource } from "@/lib/data/client";
import { clientLogoutAction } from "../login/actions";
import { MyBookingsView } from "./MyBookingsView";

export const metadata: Metadata = {
  title: `${shopConfig.name}|我的預約`,
};

export default async function MyBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;
  const session = await getClientSession();
  let bookings: Awaited<ReturnType<Awaited<ReturnType<typeof getClientDataSource>>["getBookingsForClient"]>> = [];

  if (session) {
    const ds = await getClientDataSource();
    bookings = await ds.getBookingsForClient(session.clientId);
  }

  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader active="/my-bookings" />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6">
        <div className="mb-4 flex justify-end gap-3 text-sm">
          {session ? (
            <form action={clientLogoutAction}>
              <button type="submit" className="text-muted hover:text-primary">
                登出
              </button>
            </form>
          ) : (
            <Link href="/login" className="text-primary hover:underline">
              登入
            </Link>
          )}
        </div>
        <MyBookingsView
          loggedIn={Boolean(session)}
          userName={session?.name}
          bookings={bookings}
          initialBookingId={code ?? ""}
        />
      </main>
      <SiteFooter />
    </div>
  );
}
