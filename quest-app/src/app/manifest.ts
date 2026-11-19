import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LEVEL QUEST",
    short_name: "LEVEL QUEST",
    description: "毎日のトレーニングをクエストにして、レベルを上げていく肉体管理アプリ",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0b0809",
    theme_color: "#0b0809",
    lang: "ja",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
