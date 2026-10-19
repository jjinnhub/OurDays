"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import type { FamilyMemberLite } from "@/lib/asset-constants";
import {
  EVENT_REPEAT_RULES,
  type EventRepeatKey,
  type EventRow,
} from "@/lib/calendar-constants";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2.5 text-sm font-medium"
    >
      <span
        className={cn(
          "relative inline-block h-5 w-9 shrink-0 rounded-full transition-colors",
          checked ? "bg-primary" : "bg-muted-foreground/30",
        )}
      >
        <span
          className={cn(
            "absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-4" : "translate-x-0",
          )}
        />
      </span>
      {label}
    </button>
  );
}

type Props = {
  open: boolean;
  onClose: () => void;
  familyId: string;
  currentUserId: string;
  myColor: string;
  members: FamilyMemberLite[];
  editing: EventRow | null;
  /** 날짜 칸에서 "추가"로 열 때 기본 날짜 */
  defaultDate?: string;
};

export function EventFormModal({
  open,
  onClose,
  familyId,
  currentUserId,
  myColor,
  members,
  editing,
  defaultDate,
}: Props) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [allDay, setAllDay] = useState(false);
  const [startOn, setStartOn] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endOn, setEndOn] = useState("");
  const [endTime, setEndTime] = useState("10:00");
  const [location, setLocation] = useState("");
  const [repeatOn, setRepeatOn] = useState(false);
  const [repeatRule, setRepeatRule] = useState<EventRepeatKey>("monthly");
  const [repeatUntil, setRepeatUntil] = useState("");
  const [attendees, setAttendees] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const base = defaultDate ?? new Date().toISOString().slice(0, 10);
    setTitle(editing?.title ?? "");
    setDescription(editing?.description ?? "");
    setAllDay(editing?.all_day ?? false);
    setStartOn(editing?.start_on ?? base);
    setStartTime(editing?.start_time?.slice(0, 5) ?? "09:00");
    setEndOn(editing?.end_on ?? editing?.start_on ?? base);
    setEndTime(editing?.end_time?.slice(0, 5) ?? "10:00");
    setLocation(editing?.location ?? "");
    setRepeatOn(Boolean(editing && editing.repeat_rule !== "none"));
    setRepeatRule(
      editing && editing.repeat_rule !== "none" ? editing.repeat_rule : "monthly",
    );
    setRepeatUntil(editing?.repeat_until ?? "");
    setAttendees(
      new Set(
        editing
          ? editing.event_attendees.map((a) => a.user_id)
          : [currentUserId],
      ),
    );
    setConfirmDelete(false);
    setError(null);
  }, [open, editing, currentUserId, myColor, defaultDate]);

  function toggleAttendee(userId: string) {
    setAttendees((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  async function save() {
    if (!title.trim()) {
      setError("제목을 입력해 주세요.");
      return;
    }
    if (!startOn) {
      setError("시작 날짜를 선택해 주세요.");
      return;
    }
    const effEnd = endOn || startOn;
    if (effEnd < startOn) {
      setError("종료 날짜가 시작 날짜보다 빨라요.");
      return;
    }
    if (!allDay && startOn === effEnd && endTime <= startTime) {
      setError("종료 시간이 시작 시간보다 빨라요.");
      return;
    }
    setSaving(true);
    setError(null);

    // 색상 규칙: 참석자 1인 → 그 사람 색상 / 2인 이상(또는 없음) → 등록한 사람 색상
    const attendeeIds = [...attendees];
    let eventColor: string;
    if (attendeeIds.length === 1) {
      eventColor =
        members.find((m) => m.user_id === attendeeIds[0])?.color ?? myColor;
    } else {
      const creatorId = editing?.created_by ?? currentUserId;
      eventColor =
        members.find((m) => m.user_id === creatorId)?.color ??
        editing?.color ??
        myColor;
    }

    const supabase = createClient();
    const payload = {
      title: title.trim(),
      description: description.trim(),
      all_day: allDay,
      start_on: startOn,
      start_time: allDay ? null : startTime,
      end_on: effEnd === startOn ? null : effEnd,
      end_time: allDay ? null : endTime,
      location: location.trim(),
      color: eventColor,
      repeat_rule: repeatOn ? repeatRule : "none",
      repeat_until: repeatOn && repeatUntil ? repeatUntil : null,
    };

    let eventId = editing?.id;
    if (editing) {
      const { error: dbError } = await supabase
        .from("events")
        .update(payload)
        .eq("id", editing.id);
      if (dbError) {
        setSaving(false);
        setError(dbError.message);
        return;
      }
      await supabase.from("event_attendees").delete().eq("event_id", editing.id);
    } else {
      const { data, error: dbError } = await supabase
        .from("events")
        .insert({ ...payload, family_id: familyId })
        .select("id")
        .single();
      if (dbError || !data) {
        setSaving(false);
        setError(dbError?.message ?? "저장에 실패했어요.");
        return;
      }
      eventId = data.id;
    }

    if (eventId && attendees.size > 0) {
      const { error: attErr } = await supabase.from("event_attendees").insert(
        [...attendees].map((user_id) => ({ event_id: eventId, user_id })),
      );
      if (attErr) {
        setSaving(false);
        setError(attErr.message);
        return;
      }
    }

    setSaving(false);
    onClose();
    router.refresh();
  }

  async function remove() {
    if (!editing) return;
    setDeleting(true);
    const supabase = createClient();
    const { error: dbError } = await supabase
      .from("events")
      .delete()
      .eq("id", editing.id);
    setDeleting(false);
    if (dbError) {
      setError(dbError.message);
      return;
    }
    onClose();
    router.refresh();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? "일정 수정" : "일정 추가"}
      widthClass="sm:max-w-lg"
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="evTitle">제목</Label>
          <Input
            id="evTitle"
            placeholder="일정 제목"
            maxLength={100}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="evDesc">설명 (선택)</Label>
          <textarea
            id="evDesc"
            placeholder="일정 설명"
            maxLength={500}
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="flex w-full rounded-md border border-input bg-card px-3 py-2 text-base shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:text-sm"
          />
        </div>

        <Toggle checked={allDay} onChange={setAllDay} label="종일 일정" />

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="evStartOn">시작 날짜</Label>
            <Input
              id="evStartOn"
              type="date"
              value={startOn}
              onChange={(e) => {
                setStartOn(e.target.value);
                if (endOn < e.target.value) setEndOn(e.target.value);
              }}
            />
          </div>
          {!allDay && (
            <div className="space-y-2">
              <Label htmlFor="evStartTime">시작 시간</Label>
              <Input
                id="evStartTime"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="evEndOn">종료 날짜</Label>
            <Input
              id="evEndOn"
              type="date"
              min={startOn}
              value={endOn}
              onChange={(e) => setEndOn(e.target.value)}
            />
          </div>
          {!allDay && (
            <div className="space-y-2">
              <Label htmlFor="evEndTime">종료 시간</Label>
              <Input
                id="evEndTime"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="evLocation">장소 (선택)</Label>
          <Input
            id="evLocation"
            placeholder="예: 할머니 댁"
            maxLength={100}
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
        </div>

        <div className="space-y-2.5">
          <Toggle checked={repeatOn} onChange={setRepeatOn} label="반복 일정" />
          {repeatOn && (
            <div className="space-y-2.5 rounded-lg border bg-muted/30 p-3">
              <div className="flex flex-wrap gap-1.5">
                {EVENT_REPEAT_RULES.map((r) => (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => setRepeatRule(r.key)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-medium",
                      repeatRule === r.key
                        ? "border-primary bg-primary text-primary-foreground"
                        : "bg-card text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="evRepeatUntil" className="text-xs">
                  반복 종료일 (선택 — 비우면 계속 반복)
                </Label>
                <Input
                  id="evRepeatUntil"
                  type="date"
                  min={startOn}
                  value={repeatUntil}
                  onChange={(e) => setRepeatUntil(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label>참석자</Label>
          <div className="space-y-1 rounded-lg border p-2">
            {members.map((m) => (
              <label
                key={m.user_id}
                className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
              >
                <input
                  type="checkbox"
                  checked={attendees.has(m.user_id)}
                  onChange={() => toggleAttendee(m.user_id)}
                  className="h-4 w-4 accent-[hsl(var(--primary))]"
                />
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: m.color }}
                />
                {m.display_name}
              </label>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex gap-2 pt-1">
          {editing &&
            (confirmDelete ? (
              <Button
                variant="destructive"
                className="flex-1"
                disabled={deleting}
                onClick={remove}
              >
                {deleting && <Loader2 className="animate-spin" />}
                {editing.repeat_rule !== "none" ? "반복 전체 삭제" : "정말 삭제"}
              </Button>
            ) : (
              <Button
                variant="outline"
                size="icon"
                className="shrink-0 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setConfirmDelete(true)}
                aria-label="삭제"
              >
                <Trash2 />
              </Button>
            ))}
          <Button className="h-10 flex-1" disabled={saving} onClick={save}>
            {saving && <Loader2 className="animate-spin" />}
            {editing ? "저장" : "추가"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
