import type { Metadata } from "next";

import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "파일함" };

export default function Page() {
  return <ComingSoon title="파일함" description="파일 보관 기능이 준비 중이에요." />;
}
