"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import {
  GIFT_EVENT_TYPES,
  GIFT_RELATIONS,
  GIFT_RELATION_MAP,
  type Contact,
  type GiftEventTypeKey,
  type GiftRecord,
  type GiftRelationKey,
} from "@/lib/gift-constants";
import { formatAmountInput } from "@/lib/ledger-constants";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onClose: () => void;
  familyId: string;
  contacts: Contact[];
  editing: GiftRecord | null;
  /** 관계인 상세에서 열 때 고정할 관계인 */
  fixedContactId?: string;
};

export function GiftRecordFormModal({
  open,
  onClose,
  familyId,
  contacts,
  editing,
  fixedContactId,
}: Props) {
  const router = useRouter();
  const [contactId, setContactId] = useState("");
  const [contactQuery, setContactQuery] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  // 즉석 관계인 추가
  const [newContactName, setNewContactName] = useState<string | null>(null);
  const [newContactRelation, setNewContactRelation] =
    useState<GiftRelationKey>("friend");

  const [eventType, setEventType] = useState<GiftEventTypeKey>("wedding");
  const [direction, setDirection] = useState<"given" | "received">("given");
  const [amountText, setAmountText] = useState("");
  const [date, setDate] = useState("");
  const [attended, setAttended] = useState(false);
  const [memo, setMemo] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) return;
    setContactId(editing?.contact_id ?? fixedContactId ?? "");
    setContactQuery("");
    setPickerOpen(false);
    setNewContactName(null);
    setNewContactRelation("friend");
    setEventType(editing?.event_type ?? "wedding");
    setDirection(editing?.direction ?? "given");
    setAmountText(editing ? Number(editing.amount).toLocaleString("ko-KR") : "");
    setDate(editing?.occurred_on ?? new Date().toISOString().slice(0, 10));
    setAttended(editing?.attended ?? false);
    setMemo(editing?.memo ?? "");
    setConfirmDelete(false);
    setError(null);
  }, [open, editing, fixedContactId]);

  const selectedContact = contacts.find((c) => c.id === contactId);
  const filteredContacts = useMemo(() => {
    const q = contactQuery.trim();
    if (!q) return contacts.slice(0, 20);
    return contacts
      .filter((c) => c.name.includes(q) || c.organization.includes(q))
      .slice(0, 20);
  }, [contacts, contactQuery]);

  const contactLocked = Boolean(fixedContactId || editing);

  async function save() {
    if (!contactId && !newContactName) {
      setError("관계인을 선택해 주세요.");
      return;
    }
    const amount = Number(amountText.replace(/[^0-9]/g, ""));
    if (amountText.trim() === "") {
      setError("금액을 입력해 주세요. (비현금이면 0)");
      return;
    }
    setSaving(true);
    setError(null);
    const supabase = createClient();

    // 즉석 관계인 생성
    let effectiveContactId = contactId;
    if (!effectiveContactId && newContactName) {
      const { data, error: contactError } = await supabase
        .from("contacts")
        .insert({
          family_id: familyId,
          name: newContactName.trim(),
          relation: newContactRelation,
        })
        .select("id")
        .single();
      if (contactError || !data) {
        setSaving(false);
        setError(contactError?.message ?? "관계인 추가에 실패했어요.");
        return;
      }
      effectiveContactId = data.id;
    }

    const payload = {
      contact_id: effectiveContactId,
      event_type: eventType,
      direction,
      amount,
      occurred_on: date,
      attended,
      memo: memo.trim(),
    };
    const { error: dbError } = editing
      ? await supabase.from("gift_records").update(payload).eq("id", editing.id)
      : await supabase
          .from("gift_records")
          .insert({ ...payload, family_id: familyId });
    setSaving(false);
    if (dbError) {
      setError(dbError.message);
      return;
    }
    onClose();
    router.refresh();
  }

  async function remove() {
    if (!editing) return;
    setDeleting(true);
    const supabase = createClient();
    const { error: dbError } = await supabase
      .from("gift_records")
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
      title={editing ? "기록 수정" : "경조사 기록"}
      widthClass="sm:max-w-lg"
    >
      <div className="space-y-4">
        {/* 관계인 */}
        <div className="space-y-2">
          <Label>관계인</Label>
          {contactLocked && selectedContact ? (
            <p className="flex h-11 items-center rounded-md border bg-muted/40 px-3 text-sm font-medium">
              {selectedContact.name}
              <span className="ml-2 text-xs text-muted-foreground">
                {GIFT_RELATION_MAP[selectedContact.relation].label}
              </span>
            </p>
          ) : newContactName !== null ? (
            <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
              <p className="text-sm">
                <span className="font-semibold">&lsquo;{newContactName}&rsquo;</span>{" "}
                새 관계인으로 추가해요. 관계를 골라 주세요.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {GIFT_RELATIONS.map((r) => (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => setNewContactRelation(r.key)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs font-medium",
                      newContactRelation === r.key
                        ? "border-primary bg-primary text-primary-foreground"
                        : "bg-card text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setNewContactName(null)}
                className="text-xs text-muted-foreground underline"
              >
                다시 선택하기
              </button>
            </div>
          ) : (
            <div className="relative">
              <Input
                placeholder={selectedContact ? selectedContact.name : "이름으로 검색"}
                value={pickerOpen ? contactQuery : (selectedContact?.name ?? "")}
                onFocus={() => {
                  if (blurTimer.current) clearTimeout(blurTimer.current);
                  setPickerOpen(true);
                  setContactQuery("");
                }}
                onBlur={() => {
                  blurTimer.current = setTimeout(() => setPickerOpen(false), 150);
                }}
                onChange={(e) => setContactQuery(e.target.value)}
                autoComplete="off"
              />
              {pickerOpen && (
                <ul className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-md border bg-popover shadow-md">
                  {filteredContacts.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setContactId(c.id);
                          setPickerOpen(false);
                        }}
                        className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm hover:bg-muted"
                      >
                        <span className="font-medium">{c.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {GIFT_RELATION_MAP[c.relation].label}
                          {c.organization && ` · ${c.organization}`}
                        </span>
                      </button>
                    </li>
                  ))}
                  {contactQuery.trim() && (
                    <li>
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setNewContactName(contactQuery.trim());
                          setContactId("");
                          setPickerOpen(false);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-medium text-primary hover:bg-muted"
                      >
                        <Plus className="h-4 w-4" />
                        &lsquo;{contactQuery.trim()}&rsquo; 새 관계인으로 추가
                      </button>
                    </li>
                  )}
                  {filteredContacts.length === 0 && !contactQuery.trim() && (
                    <li className="px-3 py-2.5 text-sm text-muted-foreground">
                      이름을 입력해 검색하세요.
                    </li>
                  )}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* 방향 */}
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => setDirection("given")}
            className={cn(
              "rounded-lg border py-2 text-sm font-medium transition-colors",
              direction === "given"
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground hover:bg-muted",
            )}
          >
            보냈어요
          </button>
          <button
            type="button"
            onClick={() => setDirection("received")}
            className={cn(
              "rounded-lg border py-2 text-sm font-medium transition-colors",
              direction === "received"
                ? "border-blue-600 bg-blue-600 text-white"
                : "bg-card text-muted-foreground hover:bg-muted",
            )}
          >
            받았어요
          </button>
        </div>

        {/* 유형 */}
        <div className="space-y-2">
          <Label>경조사 유형</Label>
          <div className="flex flex-wrap gap-1.5">
            {GIFT_EVENT_TYPES.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setEventType(t.key)}
                className={cn(
                  "rounded-full border px-2.5 py-1.5 text-xs font-medium transition-colors",
                  eventType === t.key
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-card text-muted-foreground hover:bg-muted",
                )}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="grAmount">금액</Label>
            <Input
              id="grAmount"
              inputMode="numeric"
              placeholder="₩ 0"
              className="text-right"
              value={amountText ? `₩ ${amountText}` : ""}
              onChange={(e) => setAmountText(formatAmountInput(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="grDate">날짜</Label>
            <Input
              id="grDate"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={attended}
            onChange={(e) => setAttended(e.target.checked)}
            className="h-4 w-4 accent-[hsl(var(--primary))]"
          />
          직접 참석했어요
        </label>

        <div className="space-y-2">
          <Label htmlFor="grMemo">메모 (선택)</Label>
          <Input
            id="grMemo"
            placeholder="예: 화환 별도, 아이 이름"
            maxLength={100}
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
          />
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
                정말 삭제
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
            {editing ? "저장" : "기록하기"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
