import { shopConfig } from "@/config/shop.config";

/** 導覽佔位:P2 週曆、P3 預約表單、P5 我的預約 完成後換成真正的連結 */
const navItems = [
  { label: "週課表", stage: "P2" },
  { label: "線上預約", stage: "P3" },
  { label: "我的預約", stage: "P5" },
];

export default function Home() {
  const resourceLabel = shopConfig.resourceLabels[shopConfig.resourceType];

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <span className="font-serif text-lg font-medium tracking-wide">
            {shopConfig.name}
          </span>
          <nav aria-label="主選單" className="flex items-center gap-6">
            {navItems.map((item) => (
              <span
                key={item.label}
                className="cursor-not-allowed text-sm text-muted"
                title={`即將推出(${item.stage})`}
                aria-disabled="true"
              >
                {item.label}
              </span>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center gap-8 px-6 py-24 text-center">
        <p className="text-sm tracking-[0.3em] text-muted">ONLINE BOOKING</p>
        <h1 className="font-serif text-4xl font-medium leading-snug sm:text-5xl">
          {shopConfig.name}
        </h1>
        <p className="max-w-md text-base leading-8 text-muted">
          線上查看{resourceLabel}的每週開放時段,挑選心儀時間送出申請,
          確認後立即收到通知。
        </p>
        <span
          className="cursor-not-allowed rounded-full bg-primary px-8 py-3 text-sm font-medium text-surface opacity-70 shadow-sm"
          aria-disabled="true"
          title="預約功能即將推出(P3)"
        >
          開始預約(即將推出)
        </span>
      </main>

      <footer className="border-t border-border bg-surface">
        <div className="mx-auto max-w-5xl px-6 py-6 text-center text-xs text-muted">
          {shopConfig.name} · 時區 {shopConfig.timezone}
        </div>
      </footer>
    </div>
  );
}
