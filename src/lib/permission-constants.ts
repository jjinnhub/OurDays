/** 권한 관리 대상 모듈 — key는 DB check 제약과 일치해야 함 */
export const PERMISSION_MODULES = [
  { key: "assets", label: "자산" },
  { key: "ledger", label: "가계부" },
  { key: "fixed_costs", label: "월 예산" },
  { key: "calendar", label: "캘린더" },
  { key: "trips", label: "여행" },
  { key: "gifts", label: "축의금" },
  { key: "shopping", label: "장바구니" },
  { key: "todos", label: "할 일" },
  { key: "meals", label: "식단표" },
  { key: "places", label: "여기어때" },
  { key: "files", label: "파일함" },
] as const;

export type PermissionModuleKey = (typeof PERMISSION_MODULES)[number]["key"];

export type MemberPermission = {
  user_id: string;
  module: PermissionModuleKey;
  can_edit: boolean;
};
