import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { shopConfig } from "@/config/shop.config";
import "./globals.css";

export const metadata: Metadata = {
  title: `${shopConfig.name}|線上預約`,
  description: `${shopConfig.name} 線上預約系統`,
};

/**
 * 每店主題色覆寫:shop.config.ts → CSS variables。
 * 只覆寫 base 色;狀態語意色(--status-*)全 template 統一,不可覆寫。
 */
const themeOverrides = {
  ...(shopConfig.theme.primary
    ? { "--color-primary": shopConfig.theme.primary }
    : {}),
  ...(shopConfig.theme.secondary
    ? { "--color-secondary": shopConfig.theme.secondary }
    : {}),
} as CSSProperties;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-TW" style={themeOverrides} className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-bg font-sans text-text">
        {children}
      </body>
    </html>
  );
}
