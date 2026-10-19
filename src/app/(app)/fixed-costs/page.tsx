import type { Metadata } from "next";

import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "월 예산" };

export default function Page() {
  return <ComingSoon title="월 예산" description="이식 준비 중이에요. 다음 단계에서 열립니다." />;
}
