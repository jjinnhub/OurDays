/** 할 일 — assignee_user_id가 null이면 가족 공통 */
export type Todo = {
  id: string;
  family_id: string;
  title: string;
  memo: string;
  assignee_user_id: string | null;
  due_on: string | null; // YYYY-MM-DD
  is_important: boolean;
  is_private: boolean;
  created_by: string;
  done_by: string | null;
  done_at: string | null;
  created_at: string;
};

export function todayDateKey(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** 기한 배지 — D-day 라벨과 톤(지남/오늘/예정) */
export function dueBadge(
  dueOn: string,
  todayKey: string,
): { label: string; tone: "overdue" | "today" | "upcoming" } {
  const diff = Math.round(
    (new Date(dueOn).getTime() - new Date(todayKey).getTime()) / 86400000,
  );
  if (diff < 0) return { label: `D+${-diff}`, tone: "overdue" };
  if (diff === 0) return { label: "오늘", tone: "today" };
  return { label: `D-${diff}`, tone: "upcoming" };
}
