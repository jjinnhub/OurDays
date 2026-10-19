export type TxType = "expense" | "income" | "transfer";

export const TX_TYPES: { key: TxType; label: string }[] = [
  { key: "expense", label: "지출" },
  { key: "income", label: "수입" },
  { key: "transfer", label: "이체" },
];

export type Category = {
  id: string;
  type: "income" | "expense";
  name: string;
  icon: string;
  color: string;
  sort_order: number;
};

export type Transaction = {
  id: string;
  type: TxType;
  title: string;
  amount: number | string;
  occurred_on: string;
  category_id: string | null;
  asset_id: string | null;
  to_asset_id: string | null;
  member_user_id: string | null;
  memo: string;
  recur_group_id: string | null;
  recur_rule: string | null;
  is_private: boolean;
};

export type AssetLite = {
  id: string;
  name: string;
  institution: string;
  group_key: string;
  is_private?: boolean;
};

/** 이체 받는 자산 후보 (타인 개인 자산은 이름·명의자만) */
export type TransferTarget = {
  id: string;
  name: string;
  institution: string;
  owner_user_id: string | null;
  is_private: boolean;
};

/** 마지막 사용 자산 기억 (빠른 입력용) */
export const LAST_ASSET_KEY = "ourdays:last-asset-id";

export function formatAmountInput(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, "");
  if (!digits) return "";
  return Number(digits).toLocaleString("ko-KR");
}

/** 반복 주기 선택지 */
export const RECUR_RULES = [
  { key: "daily", label: "매일" },
  { key: "weekdays", label: "주중" },
  { key: "weekends", label: "주말" },
  { key: "weekly", label: "매주" },
  { key: "biweekly", label: "2주마다" },
  { key: "every4weeks", label: "4주마다" },
  { key: "monthly", label: "매월" },
  { key: "monthend", label: "월말" },
  { key: "every2months", label: "2개월마다" },
  { key: "every3months", label: "3개월마다" },
  { key: "every4months", label: "4개월마다" },
  { key: "every6months", label: "6개월마다" },
  { key: "yearly", label: "1년마다" },
] as const;

export type RecurRuleKey = (typeof RECUR_RULES)[number]["key"];

export const RECUR_RULE_LABEL = Object.fromEntries(
  RECUR_RULES.map((r) => [r.key, r.label]),
) as Record<RecurRuleKey, string>;
