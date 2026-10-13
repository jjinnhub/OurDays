import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 기본은 표준 .next. 로컬(WSL 9p 마운트)에서만 캐시 문제 회피를 위해
  // 실행 스크립트가 NEXT_DIST_DIR=build 를 주입한다. Vercel에서는 항상 .next.
  distDir:
    !process.env.VERCEL && process.env.NEXT_DIST_DIR
      ? process.env.NEXT_DIST_DIR
      : ".next",
};

export default nextConfig;
