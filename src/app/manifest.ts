import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "마음카드",
    short_name: "마음카드",
    description: "마음을 전하는 감성 메시지 카드",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#fffaf7",
    theme_color: "#ef7f91",
    orientation: "portrait",
    icons: [
      {
        src: "/app-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
