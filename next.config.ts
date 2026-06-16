import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native packages are loaded by the server runtime for card image rendering.
  serverExternalPackages: ["@resvg/resvg-js", "sharp", "satori"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "oaidalleapiprodscus.blob.core.windows.net" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "k.kakaocdn.net" },
    ],
  },
};

export default nextConfig;
