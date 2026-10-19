"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Repeat, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { SelectBox } from "@/components/ui/select-box";
import type { FamilyMemberLite } from "@/lib/asset-constants";
import {
  LAST_ASSET_KEY,
  RECUR_RULES,
  RECUR_RULE_LABEL,
  TX_TYPES,
  formatAmountInput,
  type AssetLite,
  type Category,
  type RecurRuleKey,
  type Transaction,
  type TxType,
} from "@/lib/ledger-constants";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onClose: () => void;
  familyId: string;
  currentUserId: string;
  categories: Category[];
  assets: AssetLite[];
  members: FamilyMemberLite[];
  editing: Transaction | null;
  /** 목록에서 자산 필터가 걸려 있으면 그 자산을 기본 결제 수단으로 */
  defaultAssetId?: string;
  /** 개인 가계부 탭에서 열면 true — 나만 보는 거래로 기록 */
  recordPrivate?: boolean;
  /** 이체 '받는 자산' 후보 (가족 탭: 구성원 개인 자산 포함) */
  transferTargetOptions?: { value: string; label: string }[];
};

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function lastAssetId(): string {
  try {
    return window.localStorage.getItem(LAST_ASSET_KEY) ?? "";
  } catch {
    return "";
  }
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** n개월 뒤 같은 날 (짧은 달은 말일로 보정) */
function addMonthsClamp(base: Date, n: number): Date {
  const y = base.getFullYear();
  const m = base.getMonth() + n;
  const lastDay = new Date(y, m + 1, 0).getDate();
  return new Date(y, m, Math.min(base.getDate(), lastDay));
}

function lastDayOf(base: Date, monthOffset: number): Date {
  return new Date(base.getFullYear(), base.getMonth() + monthOffset + 1, 0);
}

/** 반복 규칙별 발생일 목록 (첫 발생 포함, 주기에 맞는 합리적 생성 범위) */
function recurOccurrences(rule: RecurRuleKey, start: Date): Date[] {
  const out: Date[] = [];
  const push = (d: Date) => out.push(d);

  switch (rule) {
    case "daily":
      for (let i = 0; i < 92; i++) push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
      break;
    case "weekdays":
      for (let i = 0; i < 92; i++) {
        const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
        if (d.getDay() >= 1 && d.getDay() <= 5) push(d);
      }
      break;
    case "weekends":
      for (let i = 0; i < 92; i++) {
        const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
        if (d.getDay() === 0 || d.getDay() === 6) push(d);
      }
      break;
    case "weekly":
      for (let i = 0; i < 26; i++) push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i * 7));
      break;
    case "biweekly":
      for (let i = 0; i < 13; i++) push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i * 14));
      break;
    case "every4weeks":
      for (let i = 0; i < 7; i++) push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i * 28));
      break;
    case "monthly":
      for (let i = 0; i < 12; i++) push(addMonthsClamp(start, i));
      break;
    case "monthend":
      for (let i = 0; i < 12; i++) push(lastDayOf(start, i));
      break;
    case "every2months":
      for (let i = 0; i < 6; i++) push(addMonthsClamp(start, i * 2));
      break;
    case "every3months":
      for (let i = 0; i < 4; i++) push(addMonthsClamp(start, i * 3));
      break;
    case "every4months":
      for (let i = 0; i < 3; i++) push(addMonthsClamp(start, i * 4));
      break;
    case "every6months":
      for (let i = 0; i < 2; i++) push(addMonthsClamp(start, i * 6));
      break;
    case "yearly":
      for (let i = 0; i < 2; i++) push(addMonthsClamp(start, i * 12));
      break;
  }
  return out;
}

export function TransactionFormModal({
  open,
  onClose,
  familyId,
  currentUserId,
  categories,
  assets,
  members,
  editing,
  defaultAssetId = "",
  recordPrivate = false,
  transferTargetOptions,
}: Props) {
  const router = useRouter();
  const [type, setType] = useState<TxType>("expense");
  const [amountText, setAmountText] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [assetId, setAssetId] = useState("");
  const [toAssetId, setToAssetId] = useState("");
  const [memberUserId, setMemberUserId] = useState(currentUserId);
  const [date, setDate] = useState(todayStr());
  const [title, setTitle] = useState("");
  const [memo, setMemo] = useState("");

  // 반복/할부
  const [recurPanelOpen, setRecurPanelOpen] = useState(false);
  const [panelTab, setPanelTab] = useState<"installment" | "recur">("installment");
  const [installmentInput, setInstallmentInput] = useState("");
  const [installmentMonths, setInstallmentMonths] = useState<number | null>(null);
  const [recurRule, setRecurRule] = useState<RecurRuleKey | null>(null);

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setType(editing?.type ?? "expense");
    setAmountText(editing ? Number(editing.amount).toLocaleString("ko-KR") : "");
    setCategoryId(editing?.category_id ?? "");
    setAssetId(editing?.asset_id ?? (defaultAssetId || lastAssetId()));
    setToAssetId(editing?.to_asset_id ?? "");
    setMemberUserId(editing?.member_user_id ?? currentUserId);
    setDate(editing?.occurred_on ?? todayStr());
    setTitle(editing?.title ?? "");
    setMemo(editing?.memo ?? "");
    setRecurPanelOpen(false);
    setPanelTab("installment");
    setInstallmentInput("");
    setInstallmentMonths(null);
    setRecurRule(null);
    setConfirmDelete(false);
    setError(null);
  }, [open, editing, currentUserId, defaultAssetId]);

  const visibleCategories = categories.filter(
    (c) => type !== "transfer" && c.type === type,
  );

  const assetOptions = [
    { value: "", label: "자산 선택 안 함" },
    ...assets.map((a) => ({
      value: a.id,
      label: a.institution ? `${a.institution} · ${a.name}` : a.name,
    })),
  ];

  function changeType(next: TxType) {
    setType(next);
    setCategoryId("");
    if (next !== "expense") setInstallmentMonths(null);
  }

  function confirmInstallment() {
    const n = Number(installmentInput);
    if (!Number.isInteger(n) || n < 2 || n > 60) {
      setError("할부 개월 수는 2~60 사이로 입력해 주세요.");
      return;
    }
    setError(null);
    setInstallmentMonths(n);
    setRecurRule(null);
    setRecurPanelOpen(false);
  }

  function pickRecur(rule: RecurRuleKey | null) {
    setRecurRule(rule);
    setInstallmentMonths(null);
    setRecurPanelOpen(false);
  }

  async function save() {
    const amount = Number(amountText.replace(/[^0-9]/g, ""));
    if (!amount) {
      setError("금액을 입력해 주세요.");
      return;
    }
    if (type !== "transfer" && !categoryId) {
      setError("카테고리를 선택해 주세요.");
      return;
    }
    if (type !== "transfer" && !title.trim()) {
      setError("내용을 입력해 주세요.");
      return;
    }
    if (type === "transfer") {
      if (!assetId || !toAssetId) {
        setError("보내는 자산과 받는 자산을 모두 선택해 주세요.");
        return;
      }
      if (assetId === toAssetId) {
        setError("보내는 자산과 받는 자산이 같아요.");
        return;
      }
    }
    setSaving(true);
    setError(null);

    const supabase = createClient();
    const base = {
      family_id: familyId,
      type,
      title: title.trim(),
      occurred_on: date,
      category_id: type === "transfer" ? null : categoryId,
      asset_id: assetId || null,
      to_asset_id: type === "transfer" ? toAssetId : null,
      member_user_id: isPrivateRecord ? currentUserId : memberUserId || null,
      memo: memo.trim(),
      is_private: isPrivateRecord,
    };

    let dbError = null;

    if (editing) {
      const { family_id: _familyId, ...updatePayload } = { ...base, amount };
      void _familyId;
      ({ error: dbError } = await supabase
        .from("transactions")
        .update(updatePayload)
        .eq("id", editing.id));
    } else if (installmentMonths && type === "expense") {
      // 할부: 총액을 개월 수로 나눠 매달 1건씩
      const n = installmentMonths;
      const per = Math.floor(amount / n);
      const last = amount - per * (n - 1);
      const groupId = crypto.randomUUID();
      const start = new Date(`${date}T00:00:00`);
      const rows = Array.from({ length: n }, (_, i) => ({
        ...base,
        title: `${title.trim()} (${i + 1}/${n}회차)`,
        amount: i === n - 1 ? last : per,
        occurred_on: toDateStr(addMonthsClamp(start, i)),
        recur_group_id: groupId,
        recur_rule: `installment:${n}`,
      }));
      ({ error: dbError } = await supabase.from("transactions").insert(rows));
    } else if (recurRule) {
      // 반복: 주기별 발생일을 미리 생성
      const groupId = crypto.randomUUID();
      const start = new Date(`${date}T00:00:00`);
      const rows = recurOccurrences(recurRule, start).map((d) => ({
        ...base,
        amount,
        occurred_on: toDateStr(d),
        recur_group_id: groupId,
        recur_rule: recurRule,
      }));
      ({ error: dbError } = await supabase.from("transactions").insert(rows));
    } else {
      ({ error: dbError } = await supabase
        .from("transactions")
        .insert({ ...base, amount }));
    }

    setSaving(false);
    if (dbError) {
      setError(dbError.message);
      return;
    }
    if (assetId) {
      try {
        window.localStorage.setItem(LAST_ASSET_KEY, assetId);
      } catch {
        // 저장 실패 무시
      }
    }
    onClose();
    router.refresh();
  }

  async function remove(scope: "one" | "group") {
    if (!editing) return;
    setDeleting(true);
    const supabase = createClient();
    let query = supabase
      .from("transactions")
      .update({ deleted_at: new Date().toISOString() });
    query =
      scope === "group" && editing.recur_group_id
        ? query.eq("recur_group_id", editing.recur_group_id)
        : query.eq("id", editing.id);
    const { error: dbError } = await query;
    setDeleting(false);
    if (dbError) {
      setError(dbError.message);
      return;
    }
    onClose();
    router.refresh();
  }

  const isPrivateRecord = editing ? editing.is_private : recordPrivate;

  const recurButtonLabel = installmentMonths
    ? `${installmentMonths}개월 할부`
    : recurRule
      ? RECUR_RULE_LABEL[recurRule]
      : "반복/할부";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={(editing ? "거래 수정" : "거래 입력") + (isPrivateRecord ? " · 🔒 개인" : "")}
      widthClass="sm:max-w-lg"
    >
      <div className="space-y-4">
        {/* 유형 */}
        <div className="grid grid-cols-3 gap-1.5">
          {TX_TYPES.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => changeType(t.key)}
              className={cn(
                "rounded-lg border py-2 text-sm font-medium transition-colors",
                type === t.key
                  ? t.key === "income"
                    ? "border-blue-600 bg-blue-600 text-white"
                    : t.key === "expense"
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-foreground bg-foreground text-background"
                  : "bg-card text-muted-foreground hover:bg-muted",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* 날짜 + 반복/할부 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="txDate">날짜</Label>
            <Input
              id="txDate"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>반복/할부</Label>
            {editing ? (
              <p className="flex h-11 items-center text-xs text-muted-foreground">
                {editing.recur_group_id
                  ? "반복/할부 묶음 거래예요"
                  : "수정에서는 변경할 수 없어요"}
              </p>
            ) : (
              <button
                type="button"
                onClick={() => setRecurPanelOpen((v) => !v)}
                className={cn(
                  "flex h-11 w-full items-center justify-center gap-1.5 rounded-md border text-sm font-medium transition-colors",
                  installmentMonths
                    ? "border-blue-300 bg-blue-50 text-blue-500 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-400"
                    : recurRule
                      ? "border-primary bg-primary text-primary-foreground"
                      : "bg-card text-muted-foreground hover:bg-muted",
                )}
              >
                <Repeat className="h-4 w-4" />
                {recurButtonLabel}
              </button>
            )}
          </div>
        </div>

        {/* 반복/할부 설정 패널 */}
        {recurPanelOpen && !editing && (
          <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                disabled={type !== "expense"}
                onClick={() => setPanelTab("installment")}
                className={cn(
                  "rounded-md border py-1.5 text-xs font-medium disabled:opacity-40",
                  panelTab === "installment"
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-card text-muted-foreground",
                )}
              >
                할부
              </button>
              <button
                type="button"
                onClick={() => setPanelTab("recur")}
                className={cn(
                  "rounded-md border py-1.5 text-xs font-medium",
                  panelTab === "recur"
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-card text-muted-foreground",
                )}
              >
                반복
              </button>
            </div>

            {panelTab === "installment" && type === "expense" ? (
              <div className="space-y-2">
                <Label htmlFor="installmentMonths" className="text-xs">
                  할부 입력(개월)
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="installmentMonths"
                    inputMode="numeric"
                    placeholder="예: 3"
                    className="h-9 flex-1"
                    value={installmentInput}
                    onChange={(e) =>
                      setInstallmentInput(e.target.value.replace(/[^0-9]/g, ""))
                    }
                  />
                  <Button size="sm" className="h-9" onClick={confirmInstallment}>
                    확인
                  </Button>
                  {installmentMonths && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9"
                      onClick={() => {
                        setInstallmentMonths(null);
                        setInstallmentInput("");
                      }}
                    >
                      해제
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  총액을 개월 수로 나눠 매달 1건씩 기록돼요. 내용에 회차가 붙어요.
                </p>
              </div>
            ) : panelTab === "installment" ? (
              <p className="py-2 text-center text-xs text-muted-foreground">
                할부는 지출에서만 사용할 수 있어요.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => pickRecur(null)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs font-medium",
                    !recurRule
                      ? "border-foreground bg-foreground text-background"
                      : "bg-card text-muted-foreground hover:bg-muted",
                  )}
                >
                  없음
                </button>
                {RECUR_RULES.map((r) => (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => pickRecur(r.key)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs font-medium",
                      recurRule === r.key
                        ? "border-primary bg-primary text-primary-foreground"
                        : "bg-card text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 금액 */}
        <div className="space-y-2">
          <Label htmlFor="txAmount">
            금액
            {installmentMonths && (
              <span className="font-normal text-muted-foreground">
              {" "}
                (총액 — {installmentMonths}개월로 나눠 기록)
              </span>
            )}
          </Label>
          <Input
            id="txAmount"
            inputMode="numeric"
            placeholder="₩ 0"
            className="text-right text-lg font-semibold"
            value={amountText ? `₩ ${amountText}` : ""}
            onChange={(e) => setAmountText(formatAmountInput(e.target.value))}
          />
        </div>

        {/* 카테고리 (지출/수입) */}
        {type !== "transfer" && (
          <div className="space-y-2">
            <Label>카테고리</Label>
            <div className="grid max-h-44 grid-cols-4 gap-1.5 overflow-y-auto">
              {visibleCategories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategoryId(c.id)}
                  className={cn(
                    "flex flex-col items-center gap-0.5 rounded-lg border px-1 py-2 text-xs transition-colors",
                    categoryId === c.id
                      ? "border-primary bg-primary/10 font-semibold"
                      : "bg-card text-muted-foreground hover:bg-muted",
                  )}
                >
                  <span className="text-base leading-none">{c.icon}</span>
                  <span className="whitespace-nowrap">{c.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 자산 */}
        {type === "transfer" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>보내는 자산</Label>
              <SelectBox
                value={assetId}
                onChange={setAssetId}
                placeholder="선택"
                options={assetOptions.slice(1)}
              />
            </div>
            <div className="space-y-2">
              <Label>받는 자산</Label>
              <SelectBox
                value={toAssetId}
                onChange={setToAssetId}
                placeholder="선택"
                options={transferTargetOptions ?? assetOptions.slice(1)}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <Label>{type === "expense" ? "결제 수단" : "입금 자산"} (선택)</Label>
            <SelectBox
              value={assetId}
              onChange={setAssetId}
              placeholder="자산 선택 안 함"
              options={assetOptions}
            />
          </div>
        )}

        {/* 구성원 */}
        {!isPrivateRecord && (
        <div className="space-y-2">
          <Label>구성원</Label>
          <SelectBox
            value={memberUserId}
            onChange={setMemberUserId}
            placeholder="선택"
            options={members.map((m) => ({
              value: m.user_id,
              label: m.display_name,
              dot: m.color,
            }))}
          />
        </div>
        )}

        {/* 내용 */}
        <div className="space-y-2">
          <Label htmlFor="txTitle">
            내용
            {type === "transfer" && (
              <span className="font-normal text-muted-foreground"> (선택)</span>
            )}
          </Label>
          <Input
            id="txTitle"
            placeholder={type === "transfer" ? "예: 생활비 이체" : "예: 이마트 장보기"}
            maxLength={50}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        {/* 메모 */}
        <div className="space-y-2">
          <Label htmlFor="txMemo">메모 (선택)</Label>
          <Input
            id="txMemo"
            placeholder="예: 마트 장보기"
            maxLength={100}
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {confirmDelete && editing?.recur_group_id && (
          <div className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
            <p className="text-sm font-medium text-destructive">
              반복/할부 묶음 거래예요. 어떻게 삭제할까요?
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                disabled={deleting}
                onClick={() => remove("one")}
              >
                이 거래만 삭제
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="flex-1"
                disabled={deleting}
                onClick={() => remove("group")}
              >
                {deleting && <Loader2 className="animate-spin" />}
                묶음 전체 삭제
              </Button>
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-1">
          {editing &&
            (confirmDelete && !editing.recur_group_id ? (
              <Button
                variant="destructive"
                className="flex-1"
                disabled={deleting}
                onClick={() => remove("one")}
              >
                {deleting && <Loader2 className="animate-spin" />}
                정말 삭제
              </Button>
            ) : confirmDelete ? null : (
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
