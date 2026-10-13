import type { Metadata } from "next";

export const metadata: Metadata = { title: "개인정보 처리방침" };

export default function PrivacyPage() {
  return (
    <>
      <h1 className="text-2xl font-bold">OurDays 개인정보 처리방침</h1>
      <p className="text-muted-foreground">시행일: 2026-10-09 (초안)</p>
      <h2 className="text-lg font-semibold">1. 수집 항목과 목적</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>이메일, 비밀번호 — 회원 식별 및 로그인 (필수)</li>
        <li>이름 — 가족 구성원 간 식별 표시 (필수)</li>
        <li>생년월일 — 가족 캘린더의 생일·기념일 기능 제공 (필수)</li>
        <li>휴대폰 번호 — 계정 복구 및 중요 안내 연락 (선택)</li>
      </ul>
      <h2 className="text-lg font-semibold">2. 보유 기간</h2>
      <p>회원 탈퇴 시 지체 없이 파기하며, 관계 법령에 따라 보존이 필요한 정보는 해당 기간 동안 보관합니다.</p>
      <h2 className="text-lg font-semibold">3. 처리 위탁</h2>
      <p>데이터 보관·인증 처리를 위해 Supabase Inc.의 클라우드 인프라를 이용합니다.</p>
      <p className="text-muted-foreground">
        본 문서는 초안이며 정식 오픈 전 법률 검토를 거쳐 확정합니다.
      </p>
    </>
  );
}
