/** 고정비 용도 — key는 DB check 제약과 일치 */
export const FC_PURPOSES = [
  { key: "fixed", label: "고정비", badge: "bg-sky-100 text-sky-700" },
  { key: "allowance", label: "용돈", badge: "bg-amber-100 text-amber-700" },
  { key: "savings", label: "적금", badge: "bg-emerald-100 text-emerald-700" },
  { key: "loan_interest", label: "대출이자", badge: "bg-rose-100 text-rose-700" },
  { key: "childcare", label: "육아", badge: "bg-orange-100 text-orange-700" },
  { key: "etc", label: "기타", badge: "bg-neutral-200 text-neutral-600" },
] as const;

export type FcPurposeKey = (typeof FC_PURPOSES)[number]["key"];

export const FC_PURPOSE_MAP = Object.fromEntries(
  FC_PURPOSES.map((p) => [p.key, p]),
) as Record<FcPurposeKey, (typeof FC_PURPOSES)[number]>;

export const FC_CYCLES = [
  { value: "1", label: "매월" },
  { value: "2", label: "2개월마다" },
  { value: "3", label: "3개월마다" },
  { value: "4", label: "4개월마다" },
  { value: "6", label: "6개월마다" },
  { value: "12", label: "매년" },
];

export type FixedCost = {
  id: string;
  name: string;
  amount: number | string;
  purpose: FcPurposeKey;
  cycle_months: number;
  due_day: number; // 0 = 말일
  member_user_id: string | null; // null = 공동
  asset_id: string | null;
  to_asset_id: string | null;
  category_id: string | null;
  memo: string;
  start_on: string;
  end_on: string | null;
  is_active: boolean;
  is_private: boolean;
};

export type FcOccurrence = {
  id: string;
  fixed_cost_id: string;
  due_on: string;
  amount: number | string;
  status: "pending" | "paid" | "skipped";
  paid_on: string | null;
};
