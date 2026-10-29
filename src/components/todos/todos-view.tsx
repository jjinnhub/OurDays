"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  ListTodo,
  Lock,
  Pencil,
  Plus,
  Star,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import type { FamilyMemberLite } from "@/lib/asset-constants";
import { dueBadge, todayDateKey, type Todo } from "@/lib/todo-constants";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Props = {
  familyId: string;
  currentUserId: string;
  initialTodos: Todo[];
  members: FamilyMemberLite[];
  canEdit: boolean;
};

type AssigneeFilter = "all" | "family" | string; // string = user_id

export function TodosView({
  familyId,
  currentUserId,
  initialTodos,
  members,
  canEdit,
}: Props) {
  const [todos, setTodos] = useState(initialTodos);
  const [filter, setFilter] = useState<AssigneeFilter>("all");
  const [showDone, setShowDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // 추가/수정 모달
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Todo | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formAssignee, setFormAssignee] = useState<string | null>(null); // null = 공통
  const [formDue, setFormDue] = useState("");
  const [formImportant, setFormImportant] = useState(false);
  const [formPrivate, setFormPrivate] = useState(false);
  const [formMemo, setFormMemo] = useState("");

  const memberById = useMemo(
    () => new Map(members.map((m) => [m.user_id, m])),
    [members],
  );
  const todayKey = todayDateKey();

  // ---------- Realtime 구독 (비공개 할 일은 RLS가 당사자에게만 전달) ----------
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`todos-${familyId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "todos",
          filter: `family_id=eq.${familyId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const todo = payload.new as Todo;
            setTodos((prev) =>
              prev.some((t) => t.id === todo.id) ? prev : [...prev, todo],
            );
          } else if (payload.eventType === "UPDATE") {
            const todo = payload.new as Todo;
            setTodos((prev) => prev.map((t) => (t.id === todo.id ? todo : t)));
          } else if (payload.eventType === "DELETE") {
            const old = payload.old as Partial<Todo>;
            setTodos((prev) => prev.filter((t) => t.id !== old.id));
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [familyId]);

  // ---------- 필터 + 섹션 분류 ----------
  const filtered = useMemo(
    () =>
      todos.filter((t) => {
        if (filter === "all") return true;
        if (filter === "family") return t.assignee_user_id === null;
        return t.assignee_user_id === filter;
      }),
    [todos, filter],
  );

  const sections = useMemo(() => {
    const open = filtered.filter((t) => !t.done_at);
    const done = filtered
      .filter((t) => t.done_at)
      .sort((a, b) => (b.done_at ?? "").localeCompare(a.done_at ?? ""));

    const sortOpen = (list: Todo[]) =>
      [...list].sort((a, b) => {
        if (a.is_important !== b.is_important) return a.is_important ? -1 : 1;
        const da = a.due_on ?? "9999-12-31";
        const db = b.due_on ?? "9999-12-31";
        return da.localeCompare(db) || a.created_at.localeCompare(b.created_at);
      });

    return {
      overdue: sortOpen(open.filter((t) => t.due_on && t.due_on < todayKey)),
      today: sortOpen(open.filter((t) => t.due_on === todayKey)),
      upcoming: sortOpen(open.filter((t) => t.due_on && t.due_on > todayKey)),
      noDue: sortOpen(open.filter((t) => !t.due_on)),
      done,
    };
  }, [filtered, todayKey]);

  // ---------- 추가/수정 ----------
  function openCreate() {
    setEditing(null);
    setFormTitle("");
    setFormAssignee(
      filter === "all" || filter === "family" ? null : filter,
    );
    setFormDue("");
    setFormImportant(false);
    setFormPrivate(false);
    setFormMemo("");
    setFormOpen(true);
  }

  function openEdit(todo: Todo) {
    setEditing(todo);
    setFormTitle(todo.title);
    setFormAssignee(todo.assignee_user_id);
    setFormDue(todo.due_on ?? "");
    setFormImportant(todo.is_important);
    setFormPrivate(todo.is_private);
    setFormMemo(todo.memo);
    setFormOpen(true);
  }

  async function saveTodo() {
    const title = formTitle.trim();
    if (!title || saving) return;
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const payload = {
      title,
      memo: formMemo.trim(),
      // 비공개 할 일은 본인 담당으로 고정
      assignee_user_id: formPrivate ? currentUserId : formAssignee,
      due_on: formDue || null,
      is_important: formImportant,
      is_private: formPrivate,
    };
    if (editing) {
      const { error } = await supabase
        .from("todos")
        .update(payload)
        .eq("id", editing.id);
      if (error) setError("할 일을 수정하지 못했어요.");
      else {
        setTodos((prev) =>
          prev.map((t) => (t.id === editing.id ? { ...t, ...payload } : t)),
        );
        setFormOpen(false);
      }
    } else {
      const { data, error } = await supabase
        .from("todos")
        .insert({ ...payload, family_id: familyId })
        .select()
        .single();
      if (error || !data) setError("할 일을 추가하지 못했어요.");
      else {
        const todo = data as Todo;
        setTodos((prev) =>
          prev.some((t) => t.id === todo.id) ? prev : [...prev, todo],
        );
        setFormOpen(false);
      }
    }
    setSaving(false);
  }

  async function toggleDone(todo: Todo) {
    const next = todo.done_at
      ? { done_by: null, done_at: null }
      : { done_by: currentUserId, done_at: new Date().toISOString() };
    setTodos((prev) =>
      prev.map((t) => (t.id === todo.id ? { ...t, ...next } : t)),
    );
    const supabase = createClient();
    const { error } = await supabase.from("todos").update(next).eq("id", todo.id);
    if (error) {
      setTodos((prev) => prev.map((t) => (t.id === todo.id ? todo : t)));
      setError("완료 상태를 바꾸지 못했어요.");
    }
  }

  async function deleteTodo(todo: Todo) {
    setTodos((prev) => prev.filter((t) => t.id !== todo.id));
    const supabase = createClient();
    const { error } = await supabase.from("todos").delete().eq("id", todo.id);
    if (error) {
      setTodos((prev) => [...prev, todo]);
      setError("할 일을 삭제하지 못했어요.");
    }
  }

  async function clearDone() {
    const removed = sections.done;
    if (removed.length === 0) return;
    const ids = removed.map((t) => t.id);
    setTodos((prev) => prev.filter((t) => !ids.includes(t.id)));
    const supabase = createClient();
    const { error } = await supabase.from("todos").delete().in("id", ids);
    if (error) {
      setTodos((prev) => [...prev, ...removed]);
      setError("완료 항목을 비우지 못했어요.");
    }
  }

  // ---------- 행 렌더링 ----------
  function TodoRow({ todo }: { todo: Todo }) {
    const done = Boolean(todo.done_at);
    const assignee = todo.assignee_user_id
      ? memberById.get(todo.assignee_user_id)
      : null;
    const doneBy = todo.done_by ? memberById.get(todo.done_by) : null;
    const badge = !done && todo.due_on ? dueBadge(todo.due_on, todayKey) : null;
    return (
      <li className="flex items-center gap-2.5 px-3 py-2.5">
        <Checkbox
          checked={done}
          disabled={!canEdit}
          onCheckedChange={() => void toggleDone(todo)}
          aria-label={`${todo.title} ${done ? "완료 취소" : "완료"}`}
        />
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "flex items-center gap-1.5 text-sm",
              done && "text-muted-foreground line-through",
            )}
          >
            {todo.is_important && !done && (
              <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400" />
            )}
            <span className="truncate font-medium">{todo.title}</span>
            {todo.is_private && (
              <Lock className="h-3 w-3 shrink-0 text-muted-foreground" />
            )}
            {badge && (
              <span
                className={cn(
                  "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                  badge.tone === "overdue" && "bg-destructive/10 text-destructive",
                  badge.tone === "today" && "bg-primary/10 text-primary",
                  badge.tone === "upcoming" && "bg-muted text-muted-foreground",
                )}
              >
                {badge.label}
              </span>
            )}
          </span>
          {(todo.memo || (done && todo.due_on)) && (
            <span className="block truncate text-xs text-muted-foreground">
              {done && todo.due_on ? `기한 ${todo.due_on.replaceAll("-", ".")}` : ""}
              {done && todo.due_on && todo.memo ? " · " : ""}
              {todo.memo}
            </span>
          )}
        </span>
        {done && doneBy ? (
          <span className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: doneBy.color }}
            />
            {doneBy.display_name} 완료
          </span>
        ) : assignee ? (
          <span className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: assignee.color }}
            />
            {assignee.display_name}
          </span>
        ) : (
          <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
            🏡 공통
          </span>
        )}
        {canEdit && (
          <span className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              onClick={() => openEdit(todo)}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
              aria-label="할 일 수정"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => void deleteTodo(todo)}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
              aria-label="할 일 삭제"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </span>
        )}
      </li>
    );
  }

  function Section({
    title,
    items,
    titleClass,
  }: {
    title: string;
    items: Todo[];
    titleClass?: string;
  }) {
    if (items.length === 0) return null;
    return (
      <div className="space-y-1.5">
        <p className={cn("text-xs font-semibold text-muted-foreground", titleClass)}>
          {title} {items.length}
        </p>
        <ul className="divide-y rounded-xl border bg-card">
          {items.map((todo) => (
            <TodoRow key={todo.id} todo={todo} />
          ))}
        </ul>
      </div>
    );
  }

  const openCount =
    sections.overdue.length +
    sections.today.length +
    sections.upcoming.length +
    sections.noDue.length;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">할 일</h1>
        {canEdit && (
          <Button size="sm" onClick={openCreate}>
            <Plus />
            할 일 추가
          </Button>
        )}
      </header>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* ---------- 담당 필터 ---------- */}
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={cn(
            "rounded-full border px-2.5 py-1 text-xs font-medium",
            filter === "all"
              ? "border-primary bg-primary/10"
              : "bg-card text-muted-foreground hover:bg-muted",
          )}
        >
          전체
        </button>
        <button
          type="button"
          onClick={() => setFilter("family")}
          className={cn(
            "rounded-full border px-2.5 py-1 text-xs font-medium",
            filter === "family"
              ? "border-primary bg-primary/10"
              : "bg-card text-muted-foreground hover:bg-muted",
          )}
        >
          🏡 공통
        </button>
        {members.map((m) => (
          <button
            key={m.user_id}
            type="button"
            onClick={() => setFilter(m.user_id)}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
              filter === m.user_id
                ? "border-primary bg-primary/10"
                : "bg-card text-muted-foreground hover:bg-muted",
            )}
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: m.color }}
            />
            {m.display_name}
            {m.user_id === currentUserId && " (나)"}
          </button>
        ))}
      </div>

      {/* ---------- 섹션 ---------- */}
      {openCount === 0 && sections.done.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <ListTodo className="h-7 w-7" />
            </span>
            <div>
              <p className="font-semibold">할 일이 없어요</p>
              <p className="text-sm text-muted-foreground">
                가족 공통 할 일이나 각자의 할 일을 등록해 보세요.
              </p>
            </div>
            {canEdit && (
              <Button onClick={openCreate}>
                <Plus />첫 할 일 추가
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <Section
            title="🔴 기한 지남"
            items={sections.overdue}
            titleClass="text-destructive"
          />
          <Section title="📌 오늘" items={sections.today} />
          <Section title="📅 예정" items={sections.upcoming} />
          <Section title="기한 없음" items={sections.noDue} />

          {openCount === 0 && (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                남은 할 일이 없어요 🎉
              </CardContent>
            </Card>
          )}

          {sections.done.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowDone((v) => !v)}
                  className="flex items-center gap-1 text-xs font-semibold text-muted-foreground"
                >
                  ✓ 완료 {sections.done.length}
                  {showDone ? (
                    <ChevronUp className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" />
                  )}
                </button>
                {canEdit && showDone && (
                  <button
                    type="button"
                    onClick={() => void clearDone()}
                    className="text-xs font-medium text-muted-foreground underline-offset-2 hover:underline"
                  >
                    완료 항목 비우기
                  </button>
                )}
              </div>
              {showDone && (
                <ul className="divide-y rounded-xl border bg-muted/30">
                  {sections.done.map((todo) => (
                    <TodoRow key={todo.id} todo={todo} />
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {/* ---------- 추가/수정 모달 ---------- */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? "할 일 수정" : "할 일 추가"}
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="todo-title">할 일</Label>
            <Input
              id="todo-title"
              placeholder="예: 분리수거 내놓기"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void saveTodo();
                }
              }}
            />
          </div>

          <div className="space-y-1.5">
            <Label>담당</Label>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                disabled={formPrivate}
                onClick={() => setFormAssignee(null)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs font-medium disabled:opacity-40",
                  formAssignee === null && !formPrivate
                    ? "border-primary bg-primary/10"
                    : "bg-card text-muted-foreground hover:bg-muted",
                )}
              >
                🏡 공통
              </button>
              {members.map((m) => (
                <button
                  key={m.user_id}
                  type="button"
                  disabled={formPrivate && m.user_id !== currentUserId}
                  onClick={() => setFormAssignee(m.user_id)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium disabled:opacity-40",
                    (formPrivate
                      ? m.user_id === currentUserId
                      : formAssignee === m.user_id)
                      ? "border-primary bg-primary/10"
                      : "bg-card text-muted-foreground hover:bg-muted",
                  )}
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: m.color }}
                  />
                  {m.display_name}
                  {m.user_id === currentUserId && " (나)"}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="todo-due">기한 (선택)</Label>
            <Input
              id="todo-due"
              type="date"
              value={formDue}
              onChange={(e) => setFormDue(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="todo-memo">메모 (선택)</Label>
            <Input
              id="todo-memo"
              placeholder="예: 20시 전에"
              value={formMemo}
              onChange={(e) => setFormMemo(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setFormImportant((v) => !v)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium",
                formImportant
                  ? "border-amber-400 bg-amber-400/10 text-amber-600 dark:text-amber-400"
                  : "bg-card text-muted-foreground hover:bg-muted",
              )}
            >
              <Star
                className={cn(
                  "h-3.5 w-3.5",
                  formImportant && "fill-amber-400 text-amber-400",
                )}
              />
              중요
            </button>
            <button
              type="button"
              onClick={() => setFormPrivate((v) => !v)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium",
                formPrivate
                  ? "border-primary bg-primary/10"
                  : "bg-card text-muted-foreground hover:bg-muted",
              )}
            >
              <Lock className="h-3.5 w-3.5" />
              비공개 (나만 보기)
            </button>
          </div>

          <Button
            className="w-full"
            disabled={!formTitle.trim() || saving}
            onClick={() => void saveTodo()}
          >
            {editing ? "저장" : "추가"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
