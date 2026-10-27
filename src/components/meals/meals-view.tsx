"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  CopyPlus,
  Plus,
  Tags,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { chipTextColor } from "@/lib/calendar-constants";
import { MEMBER_COLORS } from "@/lib/constants";
import {
  MEAL_FALLBACK_COLOR,
  MEAL_SLOTS,
  WEEKDAY_LABELS,
  addDays,
  toDateKey,
  weekStartOf,
  type MealCategory,
  type MealEntry,
  type MealSlotKey,
} from "@/lib/meal-constants";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Props = {
  familyId: string;
  initialCategories: MealCategory[];
  recentEntries: { name: string; category_id: string | null }[];
  canEdit: boolean;
};

export function MealsView({
  familyId,
  initialCategories,
  recentEntries,
  canEdit,
}: Props) {
  const [categories, setCategories] = useState(initialCategories);
  const [entries, setEntries] = useState<MealEntry[]>([]);
  const [weekStart, setWeekStart] = useState(() => weekStartOf(new Date()));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fetchedWeeks = useRef(new Set<string>());

  // 메뉴 추가/수정 모달
  const [formOpen, setFormOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<MealEntry | null>(null);
  const [formDate, setFormDate] = useState("");
  const [formSlot, setFormSlot] = useState<MealSlotKey>("dinner");
  const [formCategoryId, setFormCategoryId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");

  // 카테고리 관리 모달
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<MealCategory | "new" | null>(null);
  const [catName, setCatName] = useState("");
  const [catColor, setCatColor] = useState<string>(MEMBER_COLORS[0]);
  const [catConfirmDelete, setCatConfirmDelete] = useState(false);

  // 지난주 복사 모달
  const [copyOpen, setCopyOpen] = useState(false);
  const [copyLoaded, setCopyLoaded] = useState(false);

  const catById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );
  const sortedCategories = useMemo(
    () =>
      [...categories].sort(
        (a, b) =>
          a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at),
      ),
    [categories],
  );

  // 자동완성 소스 — 서버에서 받은 최근 메뉴 + 세션 중 추가한 메뉴 (이름 기준 중복 제거)
  const nameSuggestions = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const e of entries) {
      if (!map.has(e.name)) map.set(e.name, e.category_id);
    }
    for (const r of recentEntries) {
      if (!map.has(r.name)) map.set(r.name, r.category_id);
    }
    return [...map.entries()].map(([name, categoryId]) => ({ name, categoryId }));
  }, [entries, recentEntries]);

  const mergeEntries = useCallback((rows: MealEntry[]) => {
    setEntries((prev) => {
      const seen = new Set(prev.map((e) => e.id));
      const added = rows.filter((r) => !seen.has(r.id));
      return added.length > 0 ? [...prev, ...added] : prev;
    });
  }, []);

  // ---------- 주 단위 조회 (한 번 불러온 주는 캐시) ----------
  const loadWeek = useCallback(
    async (start: Date) => {
      const key = toDateKey(start);
      if (fetchedWeeks.current.has(key)) return;
      fetchedWeeks.current.add(key);
      const supabase = createClient();
      const { data, error } = await supabase
        .from("meal_entries")
        .select("id, family_id, category_id, meal_date, slot, name, created_by, created_at")
        .eq("family_id", familyId)
        .gte("meal_date", key)
        .lte("meal_date", toDateKey(addDays(start, 6)));
      if (error) {
        fetchedWeeks.current.delete(key);
        setError("식단을 불러오지 못했어요.");
        return;
      }
      mergeEntries((data as MealEntry[] | null) ?? []);
    },
    [familyId, mergeEntries],
  );

  useEffect(() => {
    void loadWeek(weekStart);
  }, [weekStart, loadWeek]);

  // ---------- 기본 카테고리 시드 ----------
  useEffect(() => {
    if (!canEdit || initialCategories.length > 0) return;
    const supabase = createClient();
    void supabase
      .rpc("ensure_meal_categories", { p_family_id: familyId })
      .then(({ data }) => {
        if (data) setCategories(data as MealCategory[]);
      });
  }, [canEdit, familyId, initialCategories.length]);

  // ---------- Realtime 구독 ----------
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`meals-${familyId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "meal_categories",
          filter: `family_id=eq.${familyId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const cat = payload.new as MealCategory;
            setCategories((prev) =>
              prev.some((c) => c.id === cat.id) ? prev : [...prev, cat],
            );
          } else if (payload.eventType === "UPDATE") {
            const cat = payload.new as MealCategory;
            setCategories((prev) => prev.map((c) => (c.id === cat.id ? cat : c)));
          } else if (payload.eventType === "DELETE") {
            const old = payload.old as Partial<MealCategory>;
            setCategories((prev) => prev.filter((c) => c.id !== old.id));
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "meal_entries",
          filter: `family_id=eq.${familyId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const entry = payload.new as MealEntry;
            setEntries((prev) =>
              prev.some((e) => e.id === entry.id) ? prev : [...prev, entry],
            );
          } else if (payload.eventType === "UPDATE") {
            const entry = payload.new as MealEntry;
            setEntries((prev) => prev.map((e) => (e.id === entry.id ? entry : e)));
          } else if (payload.eventType === "DELETE") {
            const old = payload.old as Partial<MealEntry>;
            setEntries((prev) => prev.filter((e) => e.id !== old.id));
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [familyId]);

  // ---------- 메뉴 추가/수정 ----------
  function openCreate(dateKey: string) {
    setEditingEntry(null);
    setFormDate(dateKey);
    setFormCategoryId(sortedCategories[0]?.id ?? null);
    setFormName("");
    setFormOpen(true);
  }

  function openEdit(entry: MealEntry) {
    if (!canEdit) return;
    setEditingEntry(entry);
    setFormDate(entry.meal_date);
    setFormSlot(entry.slot);
    setFormCategoryId(entry.category_id);
    setFormName(entry.name);
    setFormOpen(true);
  }

  async function saveEntry(keepOpen: boolean) {
    const name = formName.trim();
    if (!name || saving) return;
    setSaving(true);
    setError(null);
    const supabase = createClient();
    if (editingEntry) {
      const next = { slot: formSlot, category_id: formCategoryId, name };
      const { error } = await supabase
        .from("meal_entries")
        .update(next)
        .eq("id", editingEntry.id);
      if (error) setError("메뉴를 수정하지 못했어요.");
      else {
        setEntries((prev) =>
          prev.map((e) => (e.id === editingEntry.id ? { ...e, ...next } : e)),
        );
        setFormOpen(false);
      }
    } else {
      const { data, error } = await supabase
        .from("meal_entries")
        .insert({
          family_id: familyId,
          category_id: formCategoryId,
          meal_date: formDate,
          slot: formSlot,
          name,
        })
        .select()
        .single();
      if (error || !data) setError("메뉴를 추가하지 못했어요.");
      else {
        mergeEntries([data as MealEntry]);
        if (keepOpen) setFormName("");
        else setFormOpen(false);
      }
    }
    setSaving(false);
  }

  async function deleteEntry() {
    if (!editingEntry || saving) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("meal_entries")
      .delete()
      .eq("id", editingEntry.id);
    if (error) setError("메뉴를 삭제하지 못했어요.");
    else {
      setEntries((prev) => prev.filter((e) => e.id !== editingEntry.id));
      setFormOpen(false);
    }
    setSaving(false);
  }

  // ---------- 카테고리 관리 ----------
  function openCatEdit(cat: MealCategory | "new") {
    setEditingCat(cat);
    setCatName(cat === "new" ? "" : cat.name);
    setCatColor(cat === "new" ? MEMBER_COLORS[0] : cat.color);
    setCatConfirmDelete(false);
  }

  async function saveCategory() {
    if (editingCat === null || saving) return;
    const name = catName.trim();
    if (!name) return;
    setSaving(true);
    setError(null);
    const supabase = createClient();
    if (editingCat === "new") {
      const maxOrder = categories.reduce((m, c) => Math.max(m, c.sort_order), -1);
      const { data, error } = await supabase
        .from("meal_categories")
        .insert({
          family_id: familyId,
          name,
          color: catColor,
          sort_order: maxOrder + 1,
        })
        .select()
        .single();
      if (error || !data) setError("카테고리를 추가하지 못했어요.");
      else {
        const cat = data as MealCategory;
        setCategories((prev) =>
          prev.some((c) => c.id === cat.id) ? prev : [...prev, cat],
        );
        setEditingCat(null);
      }
    } else {
      const { error } = await supabase
        .from("meal_categories")
        .update({ name, color: catColor })
        .eq("id", editingCat.id);
      if (error) setError("카테고리를 수정하지 못했어요.");
      else {
        setCategories((prev) =>
          prev.map((c) =>
            c.id === editingCat.id ? { ...c, name, color: catColor } : c,
          ),
        );
        setEditingCat(null);
      }
    }
    setSaving(false);
  }

  async function deleteCategory() {
    if (editingCat === null || editingCat === "new" || saving) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("meal_categories")
      .delete()
      .eq("id", editingCat.id);
    if (error) setError("카테고리를 삭제하지 못했어요.");
    else {
      setCategories((prev) => prev.filter((c) => c.id !== editingCat.id));
      // DB는 on delete set null — 로컬도 맞춰준다
      setEntries((prev) =>
        prev.map((e) =>
          e.category_id === editingCat.id ? { ...e, category_id: null } : e,
        ),
      );
      setEditingCat(null);
    }
    setSaving(false);
  }

  // ---------- 지난주 복사 ----------
  async function openCopy() {
    setCopyLoaded(false);
    setCopyOpen(true);
    await loadWeek(addDays(weekStart, -7));
    setCopyLoaded(true);
  }

  const prevWeekEntries = useMemo(() => {
    const from = toDateKey(addDays(weekStart, -7));
    const to = toDateKey(addDays(weekStart, -1));
    return entries.filter((e) => e.meal_date >= from && e.meal_date <= to);
  }, [entries, weekStart]);

  async function copyLastWeek() {
    if (prevWeekEntries.length === 0 || saving) return;
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const rows = prevWeekEntries.map((e) => {
      const [y, m, d] = e.meal_date.split("-").map(Number);
      return {
        family_id: familyId,
        category_id: e.category_id,
        meal_date: toDateKey(addDays(new Date(y, m - 1, d), 7)),
        slot: e.slot,
        name: e.name,
      };
    });
    const { data, error } = await supabase
      .from("meal_entries")
      .insert(rows)
      .select();
    if (error || !data) setError("지난주 식단을 복사하지 못했어요.");
    else {
      mergeEntries(data as MealEntry[]);
      setCopyOpen(false);
    }
    setSaving(false);
  }

  // ---------- 표시용 ----------
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );
  const todayKey = toDateKey(new Date());
  const thisWeekEntries = useMemo(() => {
    const from = toDateKey(weekStart);
    const to = toDateKey(addDays(weekStart, 6));
    return entries.filter((e) => e.meal_date >= from && e.meal_date <= to);
  }, [entries, weekStart]);

  function entriesFor(dateKey: string, slot: MealSlotKey) {
    return thisWeekEntries
      .filter((e) => e.meal_date === dateKey && e.slot === slot)
      .sort((a, b) => {
        const oa = a.category_id ? (catById.get(a.category_id)?.sort_order ?? 99) : 99;
        const ob = b.category_id ? (catById.get(b.category_id)?.sort_order ?? 99) : 99;
        return oa - ob || a.created_at.localeCompare(b.created_at);
      });
  }

  const rangeLabel = `${weekStart.getMonth() + 1}월 ${weekStart.getDate()}일 ~ ${
    addDays(weekStart, 6).getMonth() + 1
  }월 ${addDays(weekStart, 6).getDate()}일`;

  const currentWeekSuggestions = formName.trim()
    ? nameSuggestions
        .filter(
          (s) =>
            s.name.includes(formName.trim()) && s.name !== formName.trim(),
        )
        .slice(0, 6)
    : [];

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">식단표</h1>
        {canEdit && (
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="sm" onClick={() => setCatModalOpen(true)}>
              <Tags />
              카테고리
            </Button>
            <Button variant="outline" size="sm" onClick={() => void openCopy()}>
              <CopyPlus />
              지난주 복사
            </Button>
          </div>
        )}
      </header>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* ---------- 주 이동 ---------- */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setWeekStart((w) => addDays(w, -7))}
          className="flex h-8 w-8 items-center justify-center rounded-lg border bg-card text-muted-foreground hover:bg-muted"
          aria-label="지난주"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="min-w-0 flex-1 text-center text-sm font-semibold sm:flex-none sm:px-2">
          {rangeLabel}
        </span>
        <button
          type="button"
          onClick={() => setWeekStart((w) => addDays(w, 7))}
          className="flex h-8 w-8 items-center justify-center rounded-lg border bg-card text-muted-foreground hover:bg-muted"
          aria-label="다음주"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        {toDateKey(weekStart) !== toDateKey(weekStartOf(new Date())) && (
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => setWeekStart(weekStartOf(new Date()))}
          >
            이번 주
          </Button>
        )}
      </div>

      {/* ---------- 주간 급식표 ---------- */}
      <div className="grid gap-2 md:grid-cols-7">
        {weekDays.map((day, idx) => {
          const dateKey = toDateKey(day);
          const isToday = dateKey === todayKey;
          const daySlots = MEAL_SLOTS.map((slot) => ({
            slot,
            items: entriesFor(dateKey, slot.key),
          }));
          const isEmpty = daySlots.every((s) => s.items.length === 0);
          return (
            <div
              key={dateKey}
              className={cn(
                "flex flex-col gap-1.5 rounded-xl border bg-card p-2",
                isToday && "border-primary",
              )}
            >
              <div className="flex items-baseline gap-1.5 px-0.5">
                <span
                  className={cn(
                    "text-xs font-semibold",
                    idx === 5 && "text-blue-600 dark:text-blue-400",
                    idx === 6 && "text-red-500",
                  )}
                >
                  {WEEKDAY_LABELS[idx]}
                </span>
                <span className="text-xs text-muted-foreground">
                  {day.getMonth() + 1}.{day.getDate()}
                </span>
                {isToday && (
                  <span className="rounded-full bg-primary/10 px-1.5 text-[10px] font-medium text-primary">
                    오늘
                  </span>
                )}
              </div>

              {isEmpty ? (
                <p className="px-0.5 py-1 text-[11px] text-muted-foreground">
                  등록된 메뉴 없음
                </p>
              ) : (
                daySlots.map(
                  ({ slot, items }) =>
                    items.length > 0 && (
                      <div key={slot.key} className="space-y-1 border-t pt-1.5">
                        <p className="px-0.5 text-xs font-bold text-foreground/70">
                          {slot.label}
                        </p>
                        {items.map((entry) => {
                          const color = entry.category_id
                            ? (catById.get(entry.category_id)?.color ??
                              MEAL_FALLBACK_COLOR)
                            : MEAL_FALLBACK_COLOR;
                          return (
                            <button
                              key={entry.id}
                              type="button"
                              disabled={!canEdit}
                              onClick={() => openEdit(entry)}
                              className="block w-full truncate rounded-md px-2 py-1.5 text-left text-xs font-semibold leading-tight"
                              style={{
                                backgroundColor: `${color}2E`,
                                color: chipTextColor(color),
                              }}
                            >
                              {entry.name}
                            </button>
                          );
                        })}
                      </div>
                    ),
                )
              )}

              {canEdit && (
                <button
                  type="button"
                  onClick={() => openCreate(dateKey)}
                  className="mt-auto flex h-6 w-full items-center justify-center rounded-md border border-dashed text-muted-foreground hover:bg-muted"
                  aria-label={`${dateKey} 메뉴 추가`}
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* ---------- 카테고리 범례 ---------- */}
      {sortedCategories.length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {sortedCategories.map((cat) => (
            <span
              key={cat.id}
              className="flex items-center gap-1 text-xs text-muted-foreground"
            >
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: cat.color }}
              />
              {cat.name}
            </span>
          ))}
        </div>
      )}

      {/* ---------- 메뉴 추가/수정 모달 ---------- */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingEntry ? "메뉴 수정" : "메뉴 추가"}
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {formDate.replaceAll("-", ".")}
          </p>

          <div className="space-y-1.5">
            <Label>끼니</Label>
            <div className="flex gap-1.5">
              {MEAL_SLOTS.map((slot) => (
                <button
                  key={slot.key}
                  type="button"
                  onClick={() => setFormSlot(slot.key)}
                  className={cn(
                    "flex-1 rounded-lg border px-3 py-1.5 text-sm font-medium",
                    formSlot === slot.key
                      ? "border-primary bg-primary/10"
                      : "bg-card text-muted-foreground hover:bg-muted",
                  )}
                >
                  {slot.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>카테고리</Label>
            <div className="flex flex-wrap gap-1.5">
              {sortedCategories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setFormCategoryId(cat.id)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
                    formCategoryId === cat.id
                      ? "border-primary bg-primary/10"
                      : "bg-card text-muted-foreground hover:bg-muted",
                  )}
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: cat.color }}
                  />
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="meal-name">메뉴</Label>
            <Input
              id="meal-name"
              placeholder="예: 된장찌개"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void saveEntry(!editingEntry);
                }
              }}
            />
            {currentWeekSuggestions.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {currentWeekSuggestions.map((s) => (
                  <button
                    key={s.name}
                    type="button"
                    onClick={() => {
                      setFormName(s.name);
                      if (s.categoryId && catById.has(s.categoryId)) {
                        setFormCategoryId(s.categoryId);
                      }
                    }}
                    className="rounded-full border bg-card px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted"
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-2">
            {editingEntry ? (
              <>
                <Button
                  variant="outline"
                  className="flex-1"
                  disabled={saving}
                  onClick={() => void deleteEntry()}
                >
                  <Trash2 />
                  삭제
                </Button>
                <Button
                  className="flex-1"
                  disabled={!formName.trim() || saving}
                  onClick={() => void saveEntry(false)}
                >
                  저장
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  className="flex-1"
                  disabled={!formName.trim() || saving}
                  onClick={() => void saveEntry(true)}
                >
                  저장하고 계속
                </Button>
                <Button
                  className="flex-1"
                  disabled={!formName.trim() || saving}
                  onClick={() => void saveEntry(false)}
                >
                  저장
                </Button>
              </>
            )}
          </div>
        </div>
      </Modal>

      {/* ---------- 카테고리 관리 모달 ---------- */}
      <Modal
        open={catModalOpen}
        onClose={() => {
          setCatModalOpen(false);
          setEditingCat(null);
        }}
        title="메뉴 카테고리"
      >
        {editingCat === null ? (
          <div className="space-y-3">
            <ul className="divide-y rounded-lg border">
              {sortedCategories.map((cat) => (
                <li key={cat.id}>
                  <button
                    type="button"
                    onClick={() => openCatEdit(cat)}
                    className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm hover:bg-muted/40"
                  >
                    <span
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span className="flex-1 font-medium">{cat.name}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                </li>
              ))}
              {sortedCategories.length === 0 && (
                <li className="px-3 py-6 text-center text-sm text-muted-foreground">
                  카테고리가 없어요.
                </li>
              )}
            </ul>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => openCatEdit("new")}
            >
              <Plus />
              카테고리 추가
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="meal-cat-name">이름</Label>
              <Input
                id="meal-cat-name"
                placeholder="예: 밥, 국/찌개"
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>색상</Label>
              <div className="grid grid-cols-8 gap-1.5">
                {MEMBER_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setCatColor(color)}
                    className={cn(
                      "h-7 w-7 rounded-full border-2",
                      catColor === color
                        ? "border-foreground"
                        : "border-transparent",
                    )}
                    style={{ backgroundColor: color }}
                    aria-label={color}
                  />
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setEditingCat(null)}
              >
                목록으로
              </Button>
              {editingCat !== "new" &&
                (catConfirmDelete ? (
                  <Button
                    variant="destructive"
                    className="flex-1"
                    disabled={saving}
                    onClick={() => void deleteCategory()}
                  >
                    정말 삭제할까요?
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setCatConfirmDelete(true)}
                  >
                    <Trash2 />
                    삭제
                  </Button>
                ))}
              <Button
                className="flex-1"
                disabled={!catName.trim() || saving}
                onClick={() => void saveCategory()}
              >
                {editingCat === "new" ? "추가" : "저장"}
              </Button>
            </div>
            {catConfirmDelete && (
              <p className="text-xs text-muted-foreground">
                이 카테고리를 쓰던 메뉴는 회색(카테고리 없음)으로 남아요.
              </p>
            )}
          </div>
        )}
      </Modal>

      {/* ---------- 지난주 복사 모달 ---------- */}
      <Modal
        open={copyOpen}
        onClose={() => setCopyOpen(false)}
        title="지난주 식단 복사"
      >
        <div className="space-y-4">
          {!copyLoaded ? (
            <p className="text-sm text-muted-foreground">불러오는 중...</p>
          ) : prevWeekEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              지난주에 등록된 식단이 없어요.
            </p>
          ) : (
            <p className="text-sm">
              지난주 메뉴{" "}
              <span className="font-semibold">{prevWeekEntries.length}개</span>를
              이번 주({rangeLabel})로 복사할까요?
              {thisWeekEntries.length > 0 && (
                <span className="block text-muted-foreground">
                  이번 주에 이미 {thisWeekEntries.length}개가 있어요. 복사하면
                  함께 표시돼요.
                </span>
              )}
            </p>
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setCopyOpen(false)}
            >
              취소
            </Button>
            <Button
              className="flex-1"
              disabled={!copyLoaded || prevWeekEntries.length === 0 || saving}
              onClick={() => void copyLastWeek()}
            >
              복사
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
