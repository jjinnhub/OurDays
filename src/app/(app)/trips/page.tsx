import type { Metadata } from "next";

import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "여행" };

export default function Page() {
  return <ComingSoon title="여행" description="여행 계획 기능이 준비 중이에요." />;
}
