/**
 * 통계 차트 고정 시리즈 색상.
 * dataviz 검증기 통과 조합 (lightness/chroma/CVD/contrast 전부 PASS):
 *   자산·수입 #4E7DC4 / 부채·지출 #E8645B / 순자산 #8458B3
 */
export const CHART_COLORS = {
  income: "#4E7DC4",
  expense: "#E8645B",
  asset: "#4E7DC4",
  debt: "#E8645B",
  net: "#8458B3",
} as const;

export type MonthlyFlow = {
  month: string; // "2026-05"
  label: string; // "5월"
  income: number;
  expense: number;
};

export type CategorySlice = {
  id: string;
  name: string;
  icon: string;
  color: string;
  amount: number;
};

export type MemberSpend = {
  user_id: string;
  name: string;
  color: string;
  amount: number;
};

export type GroupSlice = {
  key: string;
  label: string;
  color: string;
  amount: number;
  isLiability: boolean;
};

export type NetWorthPoint = {
  label: string; // "5월"
  asset: number;
  debt: number;
  net: number;
};
