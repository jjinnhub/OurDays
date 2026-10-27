/** 식단표 끼니 */
export const MEAL_SLOTS = [
  { key: "breakfast", label: "아침" },
  { key: "lunch", label: "점심" },
  { key: "dinner", label: "저녁" },
] as const;

export type MealSlotKey = (typeof MEAL_SLOTS)[number]["key"];

export const MEAL_SLOT_MAP = Object.fromEntries(
  MEAL_SLOTS.map((s) => [s.key, s]),
) as Record<MealSlotKey, (typeof MEAL_SLOTS)[number]>;

export type MealCategory = {
  id: string;
  family_id: string;
  name: string;
  color: string;
  sort_order: number;
  created_at: string;
};

export type MealEntry = {
  id: string;
  family_id: string;
  category_id: string | null;
  meal_date: string; // YYYY-MM-DD
  slot: MealSlotKey;
  name: string;
  created_by: string;
  created_at: string;
};

/** 카테고리가 삭제된 메뉴의 대체 색 */
export const MEAL_FALLBACK_COLOR = "#9A938C";

export const WEEKDAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"];

export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 해당 날짜가 속한 주의 월요일 */
export function weekStartOf(d: Date): Date {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (date.getDay() + 6) % 7; // 월=0 ... 일=6
  date.setDate(date.getDate() - dow);
  return date;
}

export function addDays(d: Date, n: number): Date {
  const date = new Date(d);
  date.setDate(date.getDate() + n);
  return date;
}
