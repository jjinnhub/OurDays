import type { Metadata } from "next";

export const metadata: Metadata = { title: "서비스 이용약관" };

export default function TermsPage() {
  return (
    <>
      <h1 className="text-2xl font-bold">OurDays 서비스 이용약관</h1>
      <p className="text-muted-foreground">시행일: 2026-10-09 (초안)</p>
      <p>
        본 약관은 OurDays(이하 &ldquo;서비스&rdquo;)의 이용 조건을 정합니다. 정식 오픈 전
        초안이며, 실제 운영 시 법률 검토를 거쳐 확정합니다.
      </p>
      <h2 className="text-lg font-semibold">제1조 (목적)</h2>
      <p>
        이 약관은 서비스와 이용자 간의 권리, 의무 및 책임 사항, 이용 조건과 절차를
        규정함을 목적으로 합니다.
      </p>
      <h2 className="text-lg font-semibold">제2조 (계정)</h2>
      <p>
        이용자는 본인의 이메일로 가입하고 이메일 인증을 완료해야 서비스를 이용할 수
        있습니다. 계정 정보는 본인이 안전하게 관리해야 합니다.
      </p>
      <h2 className="text-lg font-semibold">제3조 (가족 데이터)</h2>
      <p>
        가족 그룹에 입력된 일정·가계 데이터는 해당 가족 구성원에게 공유됩니다. 그룹
        탈퇴·삭제 시 데이터 처리 기준은 서비스 내 안내를 따릅니다.
      </p>
    </>
  );
}
