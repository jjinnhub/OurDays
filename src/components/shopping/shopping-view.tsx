"use client";

import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, ShoppingCart, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import type { FamilyMemberLite } from "@/lib/asset-constants";
import type { ShoppingItem, ShoppingList } from "@/lib/shopping-constants";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Props = {
  familyId: string;
  currentUserId: string;
  initialLists: ShoppingList[];
  initialItems: ShoppingItem[];
  members: FamilyMemberLite[];
  canEdit: boolean;
};

export function ShoppingView({
  familyId,
  currentUserId,
  initialLists,
  initialItems,
  members,
  canEdit,
}: Props) {
  const [lists, setLists] = useState(initialLists);
  const [items, setItems] = useState(initialItems);
  const [selectedListId, setSelectedListId] = useState<string | null>(
    initialLists[0]?.id ?? null,
  );
  const [error, setError] = useState<string | null>(null);

  // 리스트 추가/수정 모달
  const [listModalOpen, setListModalOpen] = useState(false);
  const [editingList, setEditingList] = useState<ShoppingList | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [deletingList, setDeletingList] = useState<ShoppingList | null>(null);
  const [saving, setSaving] = useState(false);

  // 항목 추가 입력
  const [itemName, setItemName] = useState("");
  const [itemQty, setItemQty] = useState("");
  const [itemMemo, setItemMemo] = useState("");

  // 항목 수정 모달
  const [editingItem, setEditingItem] = useState<ShoppingItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editQty, setEditQty] = useState("");
  const [editMemo, setEditMemo] = useState("");

  const memberById = useMemo(
    () => new Map(members.map((m) => [m.user_id, m])),
    [members],
  );

  // ---------- Realtime 구독 ----------
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`shopping-${familyId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "shopping_lists",
          filter: `family_id=eq.${familyId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const list = payload.new as ShoppingList;
            setLists((prev) =>
              prev.some((l) => l.id === list.id) ? prev : [...prev, list],
            );
          } else if (payload.eventType === "UPDATE") {
            const list = payload.new as ShoppingList;
            setLists((prev) => prev.map((l) => (l.id === list.id ? list : l)));
          } else if (payload.eventType === "DELETE") {
            const old = payload.old as Partial<ShoppingList>;
            setLists((prev) => prev.filter((l) => l.id !== old.id));
            setItems((prev) => prev.filter((i) => i.list_id !== old.id));
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "shopping_items",
          filter: `family_id=eq.${familyId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const item = payload.new as ShoppingItem;
            setItems((prev) =>
              prev.some((i) => i.id === item.id) ? prev : [...prev, item],
            );
          } else if (payload.eventType === "UPDATE") {
            const item = payload.new as ShoppingItem;
            setItems((prev) => prev.map((i) => (i.id === item.id ? item : i)));
          } else if (payload.eventType === "DELETE") {
            const old = payload.old as Partial<ShoppingItem>;
            setItems((prev) => prev.filter((i) => i.id !== old.id));
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [familyId]);

  // 선택된 리스트가 삭제되면 첫 리스트로 이동
  useEffect(() => {
    if (selectedListId && !lists.some((l) => l.id === selectedListId)) {
      setSelectedListId(lists[0]?.id ?? null);
    } else if (!selectedListId && lists.length > 0) {
      setSelectedListId(lists[0].id);
    }
  }, [lists, selectedListId]);

  const selectedList = lists.find((l) => l.id === selectedListId) ?? null;
  const selectedItems = useMemo(
    () => items.filter((i) => i.list_id === selectedListId),
    [items, selectedListId],
  );
  const unchecked = selectedItems.filter((i) => !i.checked_at);
  const checked = [...selectedItems.filter((i) => i.checked_at)].sort((a, b) =>
    (b.checked_at ?? "").localeCompare(a.checked_at ?? ""),
  );
  const uncheckedCountByList = useMemo(() => {
    const map = new Map<string, number>();
    for (const i of items) {
      if (!i.checked_at)
        map.set(i.list_id, (map.get(i.list_id) ?? 0) + 1);
    }
    return map;
  }, [items]);

  // ---------- 리스트 ----------
  function openListCreate() {
    setEditingList(null);
    setNameDraft("");
    setListModalOpen(true);
  }

  function openListEdit(list: ShoppingList) {
    setEditingList(list);
    setNameDraft(list.name);
    setListModalOpen(true);
  }

  async function saveList() {
    const name = nameDraft.trim();
    if (!name || saving) return;
    setSaving(true);
    setError(null);
    const supabase = createClient();
    if (editingList) {
      const { error } = await supabase
        .from("shopping_lists")
        .update({ name })
        .eq("id", editingList.id);
      if (error) setError("리스트 이름을 바꾸지 못했어요.");
      else {
        setLists((prev) =>
          prev.map((l) => (l.id === editingList.id ? { ...l, name } : l)),
        );
        setListModalOpen(false);
      }
    } else {
      const { data, error } = await supabase
        .from("shopping_lists")
        .insert({ family_id: familyId, name })
        .select()
        .single();
      if (error || !data) setError("리스트를 추가하지 못했어요.");
      else {
        const list = data as ShoppingList;
        setLists((prev) =>
          prev.some((l) => l.id === list.id) ? prev : [...prev, list],
        );
        setSelectedListId(list.id);
        setListModalOpen(false);
      }
    }
    setSaving(false);
  }

  async function deleteList() {
    if (!deletingList || saving) return;
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase
      .from("shopping_lists")
      .delete()
      .eq("id", deletingList.id);
    if (error) setError("리스트를 삭제하지 못했어요.");
    else {
      setItems((prev) => prev.filter((i) => i.list_id !== deletingList.id));
      setLists((prev) => prev.filter((l) => l.id !== deletingList.id));
      setDeletingList(null);
    }
    setSaving(false);
  }

  // ---------- 항목 ----------
  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    const name = itemName.trim();
    if (!name || !selectedListId) return;
    setError(null);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("shopping_items")
      .insert({
        list_id: selectedListId,
        family_id: familyId,
        name,
        quantity: itemQty.trim(),
        memo: itemMemo.trim(),
      })
      .select()
      .single();
    if (error || !data) {
      setError("항목을 추가하지 못했어요.");
      return;
    }
    const item = data as ShoppingItem;
    setItems((prev) =>
      prev.some((i) => i.id === item.id) ? prev : [...prev, item],
    );
    setItemName("");
    setItemQty("");
    setItemMemo("");
  }

  function openItemEdit(item: ShoppingItem) {
    setEditingItem(item);
    setEditName(item.name);
    setEditQty(item.quantity);
    setEditMemo(item.memo);
  }

  async function saveItemEdit() {
    if (!editingItem || saving) return;
    const name = editName.trim();
    if (!name) return;
    setSaving(true);
    setError(null);
    const next = { name, quantity: editQty.trim(), memo: editMemo.trim() };
    const supabase = createClient();
    const { error } = await supabase
      .from("shopping_items")
      .update(next)
      .eq("id", editingItem.id);
    if (error) setError("항목을 수정하지 못했어요.");
    else {
      setItems((prev) =>
        prev.map((i) => (i.id === editingItem.id ? { ...i, ...next } : i)),
      );
      setEditingItem(null);
    }
    setSaving(false);
  }

  async function toggleItem(item: ShoppingItem) {
    const next = item.checked_at
      ? { checked_by: null, checked_at: null }
      : { checked_by: currentUserId, checked_at: new Date().toISOString() };
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, ...next } : i)),
    );
    const supabase = createClient();
    const { error } = await supabase
      .from("shopping_items")
      .update(next)
      .eq("id", item.id);
    if (error) {
      // 실패 시 원복
      setItems((prev) => prev.map((i) => (i.id === item.id ? item : i)));
      setError("체크 상태를 바꾸지 못했어요.");
    }
  }

  async function deleteItem(item: ShoppingItem) {
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    const supabase = createClient();
    const { error } = await supabase
      .from("shopping_items")
      .delete()
      .eq("id", item.id);
    if (error) {
      setItems((prev) => [...prev, item]);
      setError("항목을 삭제하지 못했어요.");
    }
  }

  async function clearChecked() {
    if (!selectedListId || checked.length === 0) return;
    const removed = checked;
    setItems((prev) =>
      prev.filter((i) => i.list_id !== selectedListId || !i.checked_at),
    );
    const supabase = createClient();
    const { error } = await supabase
      .from("shopping_items")
      .delete()
      .eq("list_id", selectedListId)
      .not("checked_at", "is", null);
    if (error) {
      setItems((prev) => [...prev, ...removed]);
      setError("담은 항목을 비우지 못했어요.");
    }
  }

  function MemberDot({ userId }: { userId: string | null }) {
    const member = userId ? memberById.get(userId) : null;
    if (!member) return null;
    return (
      <span className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
        <span
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: member.color }}
        />
        {member.display_name}
      </span>
    );
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">장바구니</h1>
        {canEdit && (
          <Button variant="outline" size="sm" onClick={openListCreate}>
            <Plus />
            리스트 추가
          </Button>
        )}
      </header>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {lists.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <ShoppingCart className="h-7 w-7" />
            </span>
            <div>
              <p className="font-semibold">아직 리스트가 없어요</p>
              <p className="text-sm text-muted-foreground">
                다이소, 롯데마트, 식재료처럼 장소·목적별 리스트를 만들어 보세요.
              </p>
            </div>
            {canEdit && (
              <Button onClick={openListCreate}>
                <Plus />첫 리스트 만들기
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* ---------- 리스트 선택 ---------- */}
          <div className="flex flex-wrap gap-1.5">
            {lists.map((list) => {
              const remain = uncheckedCountByList.get(list.id) ?? 0;
              return (
                <button
                  key={list.id}
                  type="button"
                  onClick={() => setSelectedListId(list.id)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium",
                    list.id === selectedListId
                      ? "border-primary bg-primary/10"
                      : "bg-card text-muted-foreground hover:bg-muted",
                  )}
                >
                  {list.name}
                  {remain > 0 && (
                    <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary-foreground">
                      {remain}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* ---------- 선택된 리스트 ---------- */}
          {selectedList && (
            <Card>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold">{selectedList.name}</h2>
                  <span className="text-sm text-muted-foreground">
                    {checked.length}/{selectedItems.length} 담음
                  </span>
                  {canEdit && (
                    <div className="ml-auto flex items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => openListEdit(selectedList)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
                        aria-label="리스트 수정"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingList(selectedList)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
                        aria-label="리스트 삭제"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>

                {/* 모바일: 2열 그리드(항목·메모 / 수량·추가 폭 정렬), 데스크톱: 한 줄 */}
                {canEdit && (
                  <form
                    onSubmit={addItem}
                    className="grid grid-cols-[minmax(0,1fr)_5rem] gap-1.5 sm:flex sm:flex-wrap"
                  >
                    <Input
                      placeholder="항목 (예: 우유)"
                      className="h-9 sm:min-w-32 sm:flex-1"
                      value={itemName}
                      onChange={(e) => setItemName(e.target.value)}
                    />
                    <Input
                      placeholder="수량"
                      className="h-9 w-full sm:w-20"
                      value={itemQty}
                      onChange={(e) => setItemQty(e.target.value)}
                    />
                    <Input
                      placeholder="메모 (선택)"
                      className="h-9 sm:min-w-28 sm:flex-1"
                      value={itemMemo}
                      onChange={(e) => setItemMemo(e.target.value)}
                    />
                    <Button
                      type="submit"
                      size="sm"
                      className="h-9 w-full sm:w-auto"
                      disabled={!itemName.trim()}
                    >
                      <Plus />
                      추가
                    </Button>
                  </form>
                )}

                {selectedItems.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    아직 항목이 없어요. 필요한 것을 추가해 보세요.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {unchecked.length > 0 && (
                      <ul className="divide-y rounded-lg border">
                        {unchecked.map((item) => (
                          <ItemRow
                            key={item.id}
                            item={item}
                            canEdit={canEdit}
                            onToggle={toggleItem}
                            onEdit={openItemEdit}
                            onDelete={deleteItem}
                            MemberDot={MemberDot}
                          />
                        ))}
                      </ul>
                    )}

                    {checked.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-medium text-muted-foreground">
                            담은 항목 {checked.length}
                          </p>
                          {canEdit && (
                            <button
                              type="button"
                              onClick={clearChecked}
                              className="text-xs font-medium text-muted-foreground underline-offset-2 hover:underline"
                            >
                              담은 항목 비우기
                            </button>
                          )}
                        </div>
                        <ul className="divide-y rounded-lg border bg-muted/30">
                          {checked.map((item) => (
                            <ItemRow
                              key={item.id}
                              item={item}
                              canEdit={canEdit}
                              onToggle={toggleItem}
                              onEdit={openItemEdit}
                              onDelete={deleteItem}
                              MemberDot={MemberDot}
                            />
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* ---------- 리스트 추가/수정 모달 ---------- */}
      <Modal
        open={listModalOpen}
        onClose={() => setListModalOpen(false)}
        title={editingList ? "리스트 수정" : "리스트 추가"}
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="shopping-list-name">이름</Label>
            <Input
              id="shopping-list-name"
              placeholder="예: 다이소, 롯데마트, 식재료"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void saveList();
                }
              }}
            />
          </div>
          <Button
            className="w-full"
            disabled={!nameDraft.trim() || saving}
            onClick={() => void saveList()}
          >
            {editingList ? "저장" : "추가"}
          </Button>
        </div>
      </Modal>

      {/* ---------- 리스트 삭제 확인 모달 ---------- */}
      <Modal
        open={deletingList !== null}
        onClose={() => setDeletingList(null)}
        title="리스트 삭제"
      >
        {deletingList && (
          <div className="space-y-4">
            <p className="text-sm">
              <span className="font-semibold">{deletingList.name}</span> 리스트를
              삭제할까요?
              {(() => {
                const count = items.filter(
                  (i) => i.list_id === deletingList.id,
                ).length;
                return count > 0 ? (
                  <span className="block text-muted-foreground">
                    담긴 항목 {count}개도 함께 삭제돼요.
                  </span>
                ) : null;
              })()}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setDeletingList(null)}
              >
                취소
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                disabled={saving}
                onClick={() => void deleteList()}
              >
                <Trash2 />
                삭제
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ---------- 항목 수정 모달 ---------- */}
      <Modal
        open={editingItem !== null}
        onClose={() => setEditingItem(null)}
        title="항목 수정"
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="shopping-item-name">항목</Label>
            <Input
              id="shopping-item-name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="shopping-item-qty">수량</Label>
            <Input
              id="shopping-item-qty"
              placeholder="예: 2, 1kg, 3팩"
              value={editQty}
              onChange={(e) => setEditQty(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="shopping-item-memo">메모</Label>
            <Input
              id="shopping-item-memo"
              placeholder="선택"
              value={editMemo}
              onChange={(e) => setEditMemo(e.target.value)}
            />
          </div>
          <Button
            className="w-full"
            disabled={!editName.trim() || saving}
            onClick={() => void saveItemEdit()}
          >
            저장
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function ItemRow({
  item,
  canEdit,
  onToggle,
  onEdit,
  onDelete,
  MemberDot,
}: {
  item: ShoppingItem;
  canEdit: boolean;
  onToggle: (item: ShoppingItem) => void;
  onEdit: (item: ShoppingItem) => void;
  onDelete: (item: ShoppingItem) => void;
  MemberDot: React.ComponentType<{ userId: string | null }>;
}) {
  const done = Boolean(item.checked_at);
  return (
    <li className="flex items-center gap-2.5 px-3 py-2.5">
      <Checkbox
        checked={done}
        disabled={!canEdit}
        onCheckedChange={() => onToggle(item)}
        aria-label={`${item.name} ${done ? "담기 취소" : "담기"}`}
      />
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "flex items-center gap-1.5 text-sm",
            done && "text-muted-foreground line-through",
          )}
        >
          <span className="truncate font-medium">{item.name}</span>
          {item.quantity && (
            <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground no-underline">
              {item.quantity}
            </span>
          )}
        </span>
        {item.memo && (
          <span
            className={cn(
              "block truncate text-xs text-muted-foreground",
              done && "line-through",
            )}
          >
            {item.memo}
          </span>
        )}
      </span>
      <MemberDot userId={done ? item.checked_by : item.created_by} />
      {canEdit && (
        <span className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={() => onEdit(item)}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
            aria-label="항목 수정"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(item)}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
            aria-label="항목 삭제"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </span>
      )}
    </li>
  );
}
