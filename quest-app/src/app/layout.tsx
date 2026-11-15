import type { Metadata, Viewport } from "next";
import { DotGothic16 } from "next/font/google";
import { Shell } from "@/components/Shell";
import "./globals.css";

// ドット文字（日本語対応）。文字数が多いので事前読み込みはしない
const dot = DotGothic16({ weight: "400", subsets: ["latin"], preload: false, variable: "--font-dot", display: "swap" });

export const metadata: Metadata = {
  title: "LEVEL QUEST",
  description: "毎日のトレーニングをクエストにして、レベルを上げていく肉体管理アプリ",
  appleWebApp: { capable: true, title: "LEVEL QUEST", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#060a13",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className={`h-full ${dot.variable}`}>
      <body className="min-h-full font-sans">
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
