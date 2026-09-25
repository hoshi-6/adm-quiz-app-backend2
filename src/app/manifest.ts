import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ごはんナビ",
    short_name: "ごはんナビ",
    description: "食材の在庫・食事記録・不足栄養素を管理し、AIが献立を提案するアプリ",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f7f4",
    theme_color: "#2f8a4f",
    lang: "ja",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
