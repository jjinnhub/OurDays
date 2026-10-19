"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, EllipsisVertical, Loader2, Pencil, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import type { Category } from "@/lib/ledger-constants";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const EMOJI_PRESETS = [
  "🍚", "☕", "🍱", "🛒", "🚌", "🚗", "🏠", "📱", "🧺", "🛍️",
  "💄", "💊", "🏥", "📚", "🎮", "🎬", "✈️", "🎁", "🛡️", "🏦",
  "🧒", "🐶", "💼", "💰", "📈", "♻️", "🧧", "📌",
];

const COLOR_PRESETS = [
  "#E8645B", "#D4845F", "#F4A259", "#F4C25B", "#DA627D", "#C76B8E",
  "#9DB89A", "#6FA381", "#8FBCBB", "#7FA8C9", "#5B84B1", "#8E9BC7",
  "#B48EAD", "#937DC2", "#A67B5B", "#878787",
];

type Props = {
  open: boolean;
  onClose: () => void;
  familyId: string;
  categories: Category[];
};

export function CategoryManagerModal({ open, onClose, familyId, categories }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<"expense" | "income">("expense");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("📌");
  const [color, setColor] = useState(COLOR_PRESETS[0]);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setFormOpen(false);
      setEditing(null);
      setConfirmDeleteId(null);
      setError(null);
    }
  }, [open]);

  const list = categories.filter((c) => c.type === tab);

  function startCreate() {
    setEditing(null);
    setName("");
    setIcon("📌");
    setColor(COLOR_PRESETS[0]);
    setFormOpen(true);
    setError(null);
  }

  function startEdit(category: Category) {
    setEditing(category);
    setName(category.name);
    setIcon(category.icon);
    setColor(category.color);
    setFormOpen(true);
    setConfirmDeleteId(null);
    setError(null);
  }

  async function save() {
    if (!name.trim()) {
      setError("카테고리 이름을 입력해 주세요.");
      return;
    }
    setSaving(true);
    setError(null);
    const supabase = createClient();

    const payload = {
      name: name.trim(),
      icon: icon.trim() || "📌",
      color,
    };
    const { error: dbError } = editing
      ? await supabase.from("categories").update(payload).eq("id", editing.id)
      : await supabase.from("categories").insert({
          ...payload,
          family_id: familyId,
          type: tab,
          sort_order: Math.max(0, ...list.map((c) => c.sort_order)) + 1,
        });

    setSaving(false);
    if (dbError) {
      setError(dbError.message);
      return;
    }
    setFormOpen(false);
    setEditing(null);
    router.refresh();
  }

  // ---------- 드래그 정렬 ----------
  const [dragList, setDragList] = useState<Category[] | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const dragState = useRef({ startY: 0, index: 0, rowHeight: 48 });

  const visibleList = dragList ?? list;

  async function persistOrder(ordered: Category[]) {
    setMoving(true);
    setError(null);
    const supabase = createClient();
    // 해당 탭 전체의 sort_order를 표시 순서대로 다시 부여
    const { error: dbError } = await supabase.from("categories").upsert(
      ordered.map((c, i) => ({
        id: c.id,
        family_id: familyId,
        type: c.type,
        name: c.name,
        icon: c.icon,
        color: c.color,
        sort_order: i + 1,
      })),
    );
    setMoving(false);
    if (dbError) {
      setError(dbError.message);
      return;
    }
    router.refresh();
  }

  function onDragStart(e: React.PointerEvent<HTMLButtonElement>, index: number) {
    if (moving) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const row = e.currentTarget.closest("li");
    dragState.current = {
      startY: e.clientY,
      index,
      rowHeight: row?.offsetHeight ?? 48,
    };
    setDragList(list);
    setDragId(list[index].id);
  }

  function onDragMove(e: React.PointerEvent<HTMLButtonElement>) {
    if (!dragId || !dragList) return;
    const { startY, index, rowHeight } = dragState.current;
    const delta = e.clientY - startY;

    // 반 칸 이상 움직이면 이웃과 자리 교환
    if (Math.abs(delta) > rowHeight / 2) {
      const direction = delta > 0 ? 1 : -1;
      const target = index + direction;
      if (target < 0 || target >= dragList.length) return;
      const next = [...dragList];
      [next[index], next[target]] = [next[target], next[index]];
      setDragList(next);
      dragState.current = {
        startY: startY + direction * rowHeight,
        index: target,
        rowHeight,
      };
    }
  }

  function onDragEnd() {
    if (!dragId || !dragList) return;
    const changed = dragList.some((c, i) => c.id !== list[i]?.id);
    const ordered = dragList;
    setDragId(null);
    setDragList(null);
    if (changed) void persistOrder(ordered);
  }

  async function remove(id: string) {
    setDeletingId(id);
    setError(null);
    const supabase = createClient();
    const { error: dbError } = await supabase.from("categories").delete().eq("id", id);
    setDeletingId(null);
    setConfirmDeleteId(null);
    if (dbError) {
      setError(dbError.message);
      return;
    }
    if (editing?.id === id) setFormOpen(false);
    router.refresh();
  }

  return (
    <Modal open={open} onClose={onClose} title="카테고리 관리" widthClass="sm:max-w-lg">
      <div className="space-y-4">
        {/* 유형 탭 */}
        <div className="grid grid-cols-2 gap-1.5">
          {(
            [
              { key: "expense", label: "지출" },
              { key: "income", label: "수입" },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => {
                setTab(t.key);
                setFormOpen(false);
                setConfirmDeleteId(null);
              }}
              className={cn(
                "rounded-lg border py-2 text-sm font-medium transition-colors",
                tab === t.key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground hover:bg-muted",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* 추가/수정 폼 */}
        {formOpen ? (
          <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
            <p className="text-sm font-semibold">
              {editing ? `'${editing.name}' 수정` : "새 카테고리"}
            </p>
            <div className="flex gap-2">
              <div className="w-20 space-y-1.5">
                <Label className="text-xs">아이콘</Label>
                <Input
                  value={icon}
                  maxLength={4}
                  className="text-center text-lg"
                  onChange={(e) => setIcon(e.target.value)}
                />
              </div>
              <div className="flex-1 space-y-1.5">
                <Label className="text-xs">이름</Label>
                <Input
                  value={name}
                  maxLength={20}
                  placeholder="예: 반려동물"
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-1">
              {EMOJI_PRESETS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setIcon(e)}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-md text-base hover:bg-muted",
                    icon === e && "bg-primary/15 ring-1 ring-primary",
                  )}
                >
                  {e}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {COLOR_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`색상 ${c}`}
                  onClick={() => setColor(c)}
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full",
                    color === c && "ring-2 ring-ring ring-offset-1 ring-offset-card",
                  )}
                  style={{ backgroundColor: c }}
                >
                  {color === c && <Check className="h-3.5 w-3.5 text-white" />}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => setFormOpen(false)}
              >
                취소
              </Button>
              <Button size="sm" className="flex-1" disabled={saving} onClick={save}>
                {saving && <Loader2 className="animate-spin" />}
                {editing ? "저장" : "추가"}
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" size="sm" className="w-full" onClick={startCreate}>
            <Plus />새 카테고리 추가
          </Button>
        )}

        {/* 목록 */}
        <ul className={cn("divide-y rounded-lg border", dragId && "select-none")}>
          {visibleList.map((category, index) => (
            <li
              key={category.id}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 transition-colors",
                dragId === category.id && "bg-muted/70 shadow-inner",
              )}
            >
              <button
                type="button"
                aria-label="드래그해서 순서 변경"
                disabled={moving}
                onPointerDown={(e) => onDragStart(e, index)}
                onPointerMove={onDragMove}
                onPointerUp={onDragEnd}
                onPointerCancel={onDragEnd}
                className="shrink-0 cursor-grab touch-none rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing disabled:opacity-30"
              >
                <EllipsisVertical className="h-4 w-4" />
              </button>
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-base"
                style={{ backgroundColor: `${category.color}22` }}
              >
                {category.icon}
              </span>
              <span className="flex-1 truncate text-sm font-medium">
                {category.name}
              </span>
              {confirmDeleteId === category.id ? (
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={deletingId === category.id}
                  onClick={() => remove(category.id)}
                >
                  {deletingId === category.id && <Loader2 className="animate-spin" />}
                  정말 삭제
                </Button>
              ) : (
                <>
                  <button
                    type="button"
                    aria-label="수정"
                    onClick={() => startEdit(category)}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="삭제"
                    onClick={() => setConfirmDeleteId(category.id)}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </>
              )}
            </li>
          ))}
          {list.length === 0 && (
            <li className="px-3 py-4 text-center text-sm text-muted-foreground">
              카테고리가 없어요.
            </li>
          )}
        </ul>
        <p className="text-xs text-muted-foreground">
          카테고리를 삭제해도 기존 거래는 남고 &lsquo;미분류&rsquo;로 표시돼요.
        </p>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    </Modal>
  );
}
