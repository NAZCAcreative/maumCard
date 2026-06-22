import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import { CuteInteractionProvider } from "@/components/ui/CuteInteractionProvider";
import { ServiceWorkerRegistration } from "@/components/pwa/ServiceWorkerRegistration";

export const metadata: Metadata = {
  title: "마음카드",
  description: "마음을 전하는 감성 메시지 카드",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "마음카드",
    statusBarStyle: "default",
  },
  openGraph: {
    title: "마음카드",
    description: "마음을 전하는 감성 메시지 카드",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#ef7f91",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>
        <CuteInteractionProvider>
          {children}
        </CuteInteractionProvider>
        <ServiceWorkerRegistration />
        <Script
          src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
