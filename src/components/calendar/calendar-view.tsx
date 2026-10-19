"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from "lucide-react";

import { EventFormModal } from "@/components/calendar/event-form-modal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FamilyMemberLite } from "@/lib/asset-constants";
import {
  chipTextColor,
  expandEvents,
  parseDate,
  toDateStr,
  type DayChip,
  type EventRow,
} from "@/lib/calendar-constants";
import { getHoliday } from "@/lib/holidays";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

type BirthdayInfo = { user_id: string; name: string; birthdate: string; color: string };
type FcChipRow = { due_on: string; amount: number | string; name: string };

type Props = {
  familyId: string;
  currentUserId: string;
  myColor: string;
  month: string; // YYYY-MM
  events: EventRow[];
  members: FamilyMemberLite[];
  birthdays: BirthdayInfo[];
  fixedOccurrences: FcChipRow[];
  canEdit: boolean;
};

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function CalendarView({
  familyId,
  currentUserId,
  myColor,
  month,
  events,
  members,
  birthdays,
  fixedOccurrences,
  canEdit,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const today = toDateStr(new Date());
  const [selectedDate, setSelectedDate] = useState(
    today.slice(0, 7) === month ? today : `${month}-01`,
  );
  const [memberFilter, setMemberFilter] = useState<Set<string>>(
    () => new Set(members.map((m) => m.user_id)),
  );
  const [showFixed, setShowFixed] = useState(false);
  const [showBirthdays, setShowBirthdays] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<EventRow | null>(null);

  const [year, monthNum] = month.split("-").map(Number);

  // 6주 그리드 (앞뒤 달 포함 42칸)
  const gridDates = useMemo(() => {
    const first = new Date(year, monthNum - 1, 1);
    const gridStart = new Date(year, monthNum - 1, 1 - first.getDay());
    return Array.from({ length: 42 }, (_, i) =>
      toDateStr(new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i)),
    );
  }, [year, monthNum]);

  const chipsByDate = useMemo(() => {
    // 참석자가 없는 일정은 항상 표시, 있으면 선택된 구성원이 포함된 것만
    const filteredEvents = events.filter(
      (ev) =>
        ev.event_attendees.length === 0 ||
        ev.event_attendees.some((a) => memberFilter.has(a.user_id)),
    );
    const map = expandEvents(filteredEvents, gridDates[0], gridDates[41]);

    // 생일 자동 칩 (매년)
    if (showBirthdays) {
      const startYear = parseDate(gridDates[0]).getFullYear();
      const endYear = parseDate(gridDates[41]).getFullYear();
      for (const b of birthdays) {
        if (!b.birthdate) continue;
        const [, bm, bd] = b.birthdate.split("-").map(Number);
        for (let y = startYear; y <= endYear; y++) {
          const lastDay = new Date(y, bm, 0).getDate();
          const dateStr = `${y}-${String(bm).padStart(2, "0")}-${String(Math.min(bd, lastDay)).padStart(2, "0")}`;
          if (dateStr < gridDates[0] || dateStr > gridDates[41]) continue;
          const birthYear = Number(b.birthdate.slice(0, 4));
          const age = y - birthYear;
          const list = map.get(dateStr) ?? [];
          list.push({
            date: dateStr,
            kind: "birthday",
            label: `🎂 ${b.name || "생일"}${age > 0 ? ` (${age}세)` : ""}`,
            color: b.color,
            sortKey: `0-birthday-${b.name}`,
          });
          map.set(dateStr, list);
        }
      }
    }

    // 공휴일 칩 (맨 앞)
    for (const dateStr of (() => {
      const all: string[] = [];
      let cur = parseDate(gridDates[0]);
      const end = parseDate(gridDates[41]);
      while (cur <= end) {
        all.push(toDateStr(cur));
        cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 1);
      }
      return all;
    })()) {
      const name = getHoliday(dateStr);
      if (!name) continue;
      const list = map.get(dateStr) ?? [];
      list.unshift({
        date: dateStr,
        kind: "holiday",
        label: name,
        color: "#D14343",
        sortKey: "0-0-holiday",
      });
      map.set(dateStr, list);
    }

    // 고정비 자동 칩
    if (showFixed) {
      for (const occ of fixedOccurrences) {
        if (occ.due_on < gridDates[0] || occ.due_on > gridDates[41]) continue;
        const list = map.get(occ.due_on) ?? [];
        list.push({
          date: occ.due_on,
          kind: "fixed",
          label: `💸 ${occ.name}`,
          color: "#878787",
          time: undefined,
          sortKey: `2-fixed-${occ.name}`,
        });
        map.set(occ.due_on, list);
      }
    }

    for (const list of map.values()) {
      list.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
    }
    return map;
  }, [events, memberFilter, gridDates, birthdays, fixedOccurrences, showBirthdays, showFixed]);

  function toggleMemberFilter(userId: string) {
    setMemberFilter((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  function openCreate(date?: string) {
    setEditing(null);
    if (date) setSelectedDate(date);
    setModalOpen(true);
  }

  function openChip(chip: DayChip) {
    if (chip.kind === "holiday") return;
    if (chip.kind === "fixed") {
      router.push("/fixed-costs");
      return;
    }
    if (chip.kind === "event" && chip.event && canEdit) {
      setEditing(chip.event);
      setModalOpen(true);
    }
  }

  // 하단 카드용 데이터
  const selectedChips = chipsByDate.get(selectedDate) ?? [];
  const weekDates = useMemo(() => {
    const t = parseDate(today);
    const weekStart = new Date(t.getFullYear(), t.getMonth(), t.getDate() - t.getDay());
    return Array.from({ length: 7 }, (_, i) =>
      toDateStr(new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + i)),
    );
  }, [today]);

  const weekChips = useMemo(() => {
    const map = expandEvents(events, weekDates[0], weekDates[6]);
    const rows: DayChip[] = [];
    for (const d of weekDates) for (const c of map.get(d) ?? []) rows.push(c);
    return rows;
  }, [events, weekDates]);

  const upcomingChips = useMemo(() => {
    const start = weekDates[6];
    const endDate = parseDate(today);
    const end = toDateStr(
      new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate() + 30),
    );
    const map = expandEvents(events, start, end);
    const rows: DayChip[] = [];
    const dates = [...map.keys()].sort();
    for (const d of dates) {
      if (d <= weekDates[6]) continue;
      for (const c of map.get(d) ?? []) rows.push(c);
      if (rows.length >= 5) break;
    }
    return rows.slice(0, 5);
  }, [events, weekDates, today]);

  function ChipRowCard({ chip }: { chip: DayChip }) {
    const d = parseDate(chip.date);
    const ev = chip.event;
    return (
      <button
        type="button"
        onClick={() => openChip(chip)}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-lg border bg-card px-3 py-2.5 text-left",
          chip.kind === "event" && canEdit && "hover:bg-muted/40",
        )}
      >
        <span className="w-16 shrink-0 text-xs text-muted-foreground">
          {d.getMonth() + 1}/{d.getDate()} ({WEEKDAYS[d.getDay()]})
        </span>
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: chip.color }}
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{chip.label}</span>
          <span className="text-xs text-muted-foreground">
            {ev
              ? ev.all_day
                ? "종일"
                : `${ev.start_time?.slice(0, 5) ?? ""}${ev.end_time ? ` - ${ev.end_time.slice(0, 5)}` : ""}`
              : chip.kind === "birthday"
                ? "생일"
                : chip.kind === "holiday"
                  ? "공휴일"
                  : "고정비"}
            {ev?.location && ` · ${ev.location}`}
          </span>
        </span>
      </button>
    );
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">캘린더</h1>
          <p className="text-sm text-muted-foreground">가족 일정을 함께 관리해요</p>
        </div>
        {canEdit && (
          <Button size="sm" onClick={() => openCreate(selectedDate)}>
            <Plus />
            일정 추가
          </Button>
        )}
      </header>

      <Card>
        <CardContent className="space-y-3 p-4">
          {/* 월 네비게이션 */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <CalendarDays className="h-4 w-4 text-primary" />
              {year}년 {monthNum}월
            </h2>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(pathname)}
              >
                오늘
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                aria-label="이전 달"
                onClick={() => router.push(`${pathname}?month=${shiftMonth(month, -1)}`)}
              >
                <ChevronLeft />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                aria-label="다음 달"
                onClick={() => router.push(`${pathname}?month=${shiftMonth(month, 1)}`)}
              >
                <ChevronRight />
              </Button>
            </div>
          </div>

          {/* 필터 */}
          <div className="flex flex-wrap items-center gap-1.5">
            {members.map((m) => (
              <button
                key={m.user_id}
                type="button"
                onClick={() => toggleMemberFilter(m.user_id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                  memberFilter.has(m.user_id)
                    ? "border-primary bg-primary/10"
                    : "bg-card text-muted-foreground hover:bg-muted",
                )}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: m.color }}
                />
                {m.display_name}
              </button>
            ))}
            <span className="mx-1 h-4 w-px bg-border" />
            <button
              type="button"
              onClick={() => setShowFixed((v) => !v)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs font-medium",
                showFixed ? "border-primary bg-primary/10" : "bg-card text-muted-foreground",
              )}
            >
              💸 고정비
            </button>
            <button
              type="button"
              onClick={() => setShowBirthdays((v) => !v)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs font-medium",
                showBirthdays ? "border-primary bg-primary/10" : "bg-card text-muted-foreground",
              )}
            >
              🎂 생일
            </button>
          </div>

          {/* 요일 헤더 */}
          <div className="grid grid-cols-7 text-center text-xs font-medium">
            {WEEKDAYS.map((w, i) => (
              <div
                key={w}
                className={cn(
                  "py-1.5",
                  i === 0 ? "text-destructive" : i === 6 ? "text-blue-600" : "text-muted-foreground",
                )}
              >
                {w}
              </div>
            ))}
          </div>

          {/* 월 그리드 */}
          <div className="grid grid-cols-7 overflow-hidden rounded-lg border">
            {gridDates.map((dateStr) => {
              const d = parseDate(dateStr);
              const inMonth = dateStr.slice(0, 7) === month;
              const isToday = dateStr === today;
              const isSelected = dateStr === selectedDate;
              const chips = chipsByDate.get(dateStr) ?? [];
              const dow = d.getDay();
              const holiday = getHoliday(dateStr);
              return (
                <div
                  key={dateStr}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedDate(dateStr)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") setSelectedDate(dateStr);
                  }}
                  className={cn(
                    "flex min-h-24 cursor-pointer flex-col items-stretch gap-1 border-b border-r p-1.5 text-left align-top transition-colors last:border-r-0 md:min-h-28",
                    !inMonth && "bg-muted/30",
                    holiday && inMonth && "bg-destructive/5",
                    isSelected && "bg-primary/5 ring-1 ring-inset ring-primary/40",
                    "hover:bg-muted/40",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                      isToday && "bg-primary font-bold text-primary-foreground",
                      !isToday && (dow === 0 || holiday) && "text-destructive",
                      !isToday && dow === 6 && !holiday && "text-blue-600",
                      !isToday && !inMonth && "text-muted-foreground/50",
                    )}
                  >
                    {d.getDate()}
                  </span>
                  {chips.slice(0, 3).map((chip, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedDate(dateStr);
                        openChip(chip);
                      }}
                      className={cn(
                        "truncate rounded-md px-1.5 py-0.5 text-left text-xs font-medium leading-5",
                        chip.kind === "event" && canEdit && "hover:brightness-95",
                      )}
                      style={{
                        backgroundColor: `${chip.color}2E`,
                        color: chip.kind === "fixed" ? undefined : chipTextColor(chip.color),
                      }}
                    >
                      {chip.time && <span className="opacity-70">{chip.time} </span>}
                      {chip.label}
                    </button>
                  ))}
                  {chips.length > 3 && (
                    <span className="px-1.5 text-[11px] text-muted-foreground">
                      +{chips.length - 3}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ---------- 하단 3카드 ---------- */}
      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <CardHeader className="px-4 pb-1.5 pt-3.5">
            <CardTitle className="text-base">
              {selectedDate === today
                ? "오늘의 일정"
                : `${Number(selectedDate.slice(5, 7))}월 ${Number(selectedDate.slice(8, 10))}일 일정`}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 px-4 pb-3.5 pt-0">
            {selectedChips.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                일정이 없어요.
              </p>
            ) : (
              selectedChips.map((chip, i) => <ChipRowCard key={i} chip={chip} />)
            )}
            {canEdit && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-full"
                onClick={() => openCreate(selectedDate)}
              >
                <Plus />이 날짜에 일정 추가
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="px-4 pb-1.5 pt-3.5">
            <CardTitle className="text-base">이번주 일정</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 px-4 pb-3.5 pt-0">
            {weekChips.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                이번 주 일정이 없어요.
              </p>
            ) : (
              weekChips.map((chip, i) => <ChipRowCard key={i} chip={chip} />)
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="px-4 pb-1.5 pt-3.5">
            <CardTitle className="text-base">다가올 일정</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 px-4 pb-3.5 pt-0">
            {upcomingChips.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                다가올 일정이 없어요.
              </p>
            ) : (
              upcomingChips.map((chip, i) => <ChipRowCard key={i} chip={chip} />)
            )}
          </CardContent>
        </Card>
      </div>

      <EventFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        familyId={familyId}
        currentUserId={currentUserId}
        myColor={myColor}
        members={members}
        editing={editing}
        defaultDate={selectedDate}
      />
    </div>
  );
}
