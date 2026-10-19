/** 자산 그룹 정의 — key는 DB check 제약과 일치해야 함 */
export const ASSET_GROUPS = [
  { key: "cash", label: "현금", isLiability: false, color: "#F4C25B" },
  { key: "bank", label: "은행", isLiability: false, color: "#7FA8C9" },
  { key: "check_card", label: "체크카드", isLiability: false, color: "#8FBCBB" },
  { key: "credit_card", label: "신용카드", isLiability: true, color: "#E8645B" },
  { key: "savings", label: "저축", isLiability: false, color: "#9DB89A" },
  { key: "investment", label: "투자", isLiability: false, color: "#937DC2" },
  { key: "overdraft", label: "마이너스 통장", isLiability: true, color: "#DA627D" },
  { key: "loan", label: "대출", isLiability: true, color: "#C76B8E" },
  { key: "insurance", label: "보험", isLiability: false, color: "#A67B5B" },
  { key: "etc", label: "기타", isLiability: false, color: "#878787" },
] as const;

export type AssetGroupKey = (typeof ASSET_GROUPS)[number]["key"];

export const ASSET_GROUP_MAP = Object.fromEntries(
  ASSET_GROUPS.map((g) => [g.key, g]),
) as Record<AssetGroupKey, (typeof ASSET_GROUPS)[number]>;

/** 기관 프리셋 (datalist 자동완성용) — 직접 입력도 가능 */
export const INSTITUTIONS = [
  // 은행
  "KB국민은행", "신한은행", "우리은행", "하나은행", "NH농협은행", "IBK기업은행",
  "SC제일은행", "씨티은행", "케이뱅크", "카카오뱅크", "토스뱅크", "새마을금고",
  "신협", "우체국", "수협은행", "iM뱅크", "부산은행", "경남은행", "광주은행",
  "전북은행", "제주은행",
  // 증권
  "키움증권", "미래에셋증권", "삼성증권", "NH투자증권", "한국투자증권", "KB증권",
  "신한투자증권", "토스증권", "카카오페이증권", "하나증권", "대신증권", "메리츠증권",
  // 카드
  "신한카드", "삼성카드", "현대카드", "KB국민카드", "롯데카드", "우리카드",
  "하나카드", "BC카드",
  // 보험
  "삼성생명", "한화생명", "교보생명", "삼성화재", "DB손해보험", "현대해상",
  "KB손해보험", "메리츠화재",
  // 핀테크/기타
  "토스", "카카오페이", "네이버페이", "페이코",
] as const;

export type Asset = {
  id: string;
  group_key: AssetGroupKey;
  institution: string;
  name: string;
  amount: number | string;
  owner_user_id: string | null;
  memo: string;
  balance_date: string;
  maturity_on: string | null;
  is_private: boolean;
};

export type FamilyMemberLite = {
  user_id: string;
  display_name: string;
  color: string;
};
