import Link from "next/link";
import { shopConfig } from "@/config/shop.config";
import { getBranchSelection } from "@/lib/branch";
import { BranchSelect } from "./BranchSelect";

/** 導覽:P2 週曆、P3 線上預約、P5 我的預約 */
const navItems = [
  { label: "週課表", href: "/timetable" },
  { label: "線上預約", href: "/book" },
  { label: "我的預約", href: "/my-bookings" },
] as const;

/**
 * 前台頁首。
 *
 * 分店(PLAN.md §14):店名是**事業**名(shop.config.ts),分店選擇器在其右側。
 * 啟用分店只有一間 → 完全不渲染選擇器:單店事業的介面上看不到「分店」這個概念,
 * 也不會多一次點擊。
 */
export async function SiteHeader({ active }: { active?: string }) {
  const { branches, selected, showSelector } = await getBranchSelection();

  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/"
            className="truncate font-serif text-lg font-medium tracking-wide"
          >
            {shopConfig.name}
          </Link>
          {showSelector && (
            <BranchSelect
              branches={branches.map((b) => ({ slug: b.slug, name: b.name }))}
              selectedSlug={selected?.slug ?? null}
            />
          )}
        </div>
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
