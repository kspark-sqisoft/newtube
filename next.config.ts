import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "image.mux.com" },
      { protocol: "https", hostname: "utfs.io" },
      // UploadThing v7 의 새 자산 도메인
      { protocol: "https", hostname: "*.ufs.sh" },
      // Clerk 의 사용자 아바타
      { protocol: "https", hostname: "img.clerk.com" },
    ],
  },
};

export default nextConfig;
