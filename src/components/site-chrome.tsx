import Link from "next/link";
import { shopConfig } from "@/config/shop.config";

/** 導覽:P2 週曆、P3 線上預約、P5 我的預約 */
const navItems = [
  { label: "週課表", href: "/timetable" },
  { label: "線上預約", href: "/book" },
  { label: "我的預約", href: "/my-bookings" },
] as const;

export function SiteHeader({ active }: { active?: string }) {
  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Link
          href="/"
          className="font-serif text-lg font-medium tracking-wide"
        >
          {shopConfig.name}
        </Link>
        <nav aria-label="主選單" className="flex items-center gap-4 sm:gap-6">
          {navItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              aria-current={active === item.href ? "page" : undefined}
              className={`flex min-h-11 items-center text-sm ${
                active === item.href
                  ? "font-medium text-primary"
                  : "text-text hover:text-primary"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto max-w-6xl px-6 py-6 text-center text-xs text-muted">
        {shopConfig.name} · 時區 {shopConfig.timezone}
      </div>
    </footer>
  );
}
