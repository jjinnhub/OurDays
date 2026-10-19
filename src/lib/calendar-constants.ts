export const EVENT_REPEAT_RULES = [
  { key: "daily", label: "매일" },
  { key: "weekly", label: "매주" },
  { key: "monthly", label: "매월" },
  { key: "yearly", label: "매년" },
] as const;

export type EventRepeatKey = "none" | (typeof EVENT_REPEAT_RULES)[number]["key"];

export type EventRow = {
  id: string;
  title: string;
  description: string;
  all_day: boolean;
  start_on: string;
  start_time: string | null;
  end_on: string | null;
  end_time: string | null;
  location: string;
  color: string;
  repeat_rule: EventRepeatKey;
  repeat_until: string | null;
  created_by: string;
  event_attendees: { user_id: string }[];
};

/** 하루 단위로 펼쳐진 일정 칩 */
export type DayChip = {
  date: string;
  kind: "event" | "birthday" | "fixed" | "holiday";
  event?: EventRow;
  label: string;
  color: string;
  time?: string; // "09:00"
  sortKey: string;
};

export function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

function addMonthsClamp(d: Date, n: number, origDay: number): Date {
  const y = d.getFullYear();
  const m = d.getMonth() + n;
  const lastDay = new Date(y, m + 1, 0).getDate();
  return new Date(y, m, Math.min(origDay, lastDay));
}

function diffDays(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

/** 반복 규칙을 포함해 일정들을 [rangeStart, rangeEnd] 구간의 일자별 칩으로 전개 */
export function expandEvents(
  events: EventRow[],
  rangeStart: string,
  rangeEnd: string,
): Map<string, DayChip[]> {
  const out = new Map<string, DayChip[]>();
  const rs = parseDate(rangeStart);
  const re = parseDate(rangeEnd);

  function pushSpan(ev: EventRow, occStart: Date) {
    const duration = ev.end_on
      ? diffDays(parseDate(ev.start_on), parseDate(ev.end_on))
      : 0;
    for (let d = 0; d <= duration; d++) {
      const day = addDays(occStart, d);
      if (day < rs || day > re) continue;
      const dateStr = toDateStr(day);
      const time =
        !ev.all_day && ev.start_time && d === 0 ? ev.start_time.slice(0, 5) : undefined;
      const chip: DayChip = {
        date: dateStr,
        kind: "event",
        event: ev,
        label: ev.title,
        color: ev.color,
        time,
        sortKey: `1-${ev.all_day ? "0" : (ev.start_time ?? "99:99")}-${ev.title}`,
      };
      const list = out.get(dateStr) ?? [];
      list.push(chip);
      out.set(dateStr, list);
    }
  }

  for (const ev of events) {
    const start = parseDate(ev.start_on);
    const until = ev.repeat_until ? parseDate(ev.repeat_until) : re;
    const limit = until < re ? until : re;

    if (ev.repeat_rule === "none") {
      pushSpan(ev, start);
      continue;
    }

    const origDay = start.getDate();
    for (let i = 0; i < 1000; i++) {
      let occ: Date;
      if (ev.repeat_rule === "daily") occ = addDays(start, i);
      else if (ev.repeat_rule === "weekly") occ = addDays(start, i * 7);
      else if (ev.repeat_rule === "monthly") occ = addMonthsClamp(start, i, origDay);
      else occ = addMonthsClamp(start, i * 12, origDay); // yearly

      if (occ > limit) break;
      pushSpan(ev, occ);
    }
  }
  return out;
}

/**
 * 멤버 색상이 밝아도 칩 글자가 읽히도록, 같은 색조의 어두운 텍스트 색을 만든다.
 * (명도를 38% 이하로, 채도를 최소 45%로 보정. 무채색은 그대로 어둡게만)
 */
export function chipTextColor(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const rn = ((n >> 16) & 255) / 255;
  const gn = ((n >> 8) & 255) / 255;
  const bn = (n & 255) / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  let sat = 0;
  if (d !== 0) {
    sat = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
  }
  const sOut = sat < 0.12 ? sat * 100 : Math.max(sat * 100, 45);
  const lOut = Math.min(l * 100, 38);
  return `hsl(${Math.round(h)}, ${Math.round(sOut)}%, ${Math.round(lOut)}%)`;
}
