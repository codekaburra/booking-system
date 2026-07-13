import Link from "next/link";
import { shopConfig } from "@/config/shop.config";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";

export default function Home() {
  const resourceLabel = shopConfig.resourceLabels[shopConfig.resourceType];

  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center gap-8 px-6 py-24 text-center">
        <p className="text-sm tracking-[0.3em] text-muted">ONLINE BOOKING</p>
        <h1 className="font-serif text-4xl font-medium leading-snug sm:text-5xl">
          {shopConfig.name}
        </h1>
        <p className="max-w-md text-base leading-8 text-muted">
          線上查看{resourceLabel}的每週開放時段,挑選心儀時間送出申請,
          確認後立即收到通知。
        </p>
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <Link
            href="/book"
            className="rounded-full bg-primary px-8 py-3 text-sm font-medium text-surface shadow-sm transition hover:opacity-90"
          >
            開始預約
          </Link>
          <Link
            href="/timetable"
            className="rounded-full border border-border bg-surface px-8 py-3 text-sm text-text transition hover:border-primary hover:text-primary"
          >
            查看週課表
          </Link>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
