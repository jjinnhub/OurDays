"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { SelectBox } from "@/components/ui/select-box";
import type { FamilyMemberLite } from "@/lib/asset-constants";
import {
  FC_CYCLES,
  FC_PURPOSES,
  type FcPurposeKey,
  type FixedCost,
} from "@/lib/fixed-cost-constants";
import { formatAmountInput, type AssetLite } from "@/lib/ledger-constants";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onClose: () => void;
  familyId: string;
  members: FamilyMemberLite[];
  assets: AssetLite[];
  editing: FixedCost | null;
  currentUserId: string;
  /** 내 예산 탭에서 열면 true — 나만 보는 항목으로 기록 */
  recordPrivate?: boolean;
};

const DUE_DAY_OPTIONS = [
  { value: "0", label: "말일" },
  ...Array.from({ length: 31 }, (_, i) => ({
    value: String(i + 1),
    label: `${i + 1}일`,
  })),
];

export function FixedCostFormModal({
  open,
  onClose,
  familyId,
  members,
  assets,
  editing,
  currentUserId,
  recordPrivate = false,
}: Props) {
  const isPrivateRecord = editing ? editing.is_private : recordPrivate;
  const router = useRouter();
  const [name, setName] = useState("");
  const [amountText, setAmountText] = useState("");
  const [purpose, setPurpose] = useState<FcPurposeKey>("fixed");
  const [cycle, setCycle] = useState("1");
  const [dueDay, setDueDay] = useState("1");
  const [memberUserId, setMemberUserId] = useState(""); // "" = 공동
  const [assetId, setAssetId] = useState("");
  const [startOn, setStartOn] = useState("");
  const [endOn, setEndOn] = useState("");
  const [memo, setMemo] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? "");
    setAmountText(editing ? Number(editing.amount).toLocaleString("ko-KR") : "");
    setPurpose(editing?.purpose ?? "fixed");
    setCycle(String(editing?.cycle_months ?? 1));
    setDueDay(String(editing?.due_day ?? 1));
    setMemberUserId(editing?.member_user_id ?? "");
    setAssetId(editing?.asset_id ?? "");
    setStartOn(editing?.start_on ?? new Date().toISOString().slice(0, 10));
    setEndOn(editing?.end_on ?? "");
    setMemo(editing?.memo ?? "");
    setIsActive(editing?.is_active ?? true);
    setConfirmDelete(false);
    setError(null);
  }, [open, editing]);

  const assetOptions = assets.map((a) => ({
    value: a.id,
    label: a.institution ? `${a.institution} · ${a.name}` : a.name,
  }));

  async function save() {
    if (!name.trim()) {
      setError("이름을 입력해 주세요.");
      return;
    }
    const amount = Number(amountText.replace(/[^0-9]/g, ""));
    if (!amount) {
      setError("금액을 입력해 주세요.");
      return;
    }
    if (!assetId) {
      setError("분배할 자산을 선택해 주세요.");
      return;
    }
    setSaving(true);
    setError(null);

    const supabase = createClient();
    const payload = {
      name: name.trim(),
      amount,
      purpose,
      cycle_months: Number(cycle),
      due_day: Number(dueDay),
      member_user_id: isPrivateRecord ? currentUserId : memberUserId || null,
      is_private: isPrivateRecord,
      asset_id: assetId,
      to_asset_id: null,
      category_id: null,
      start_on: startOn,
      end_on: endOn || null,
      memo: memo.trim(),
      is_active: isActive,
    };

    const { error: dbError } = editing
      ? await supabase.from("fixed_costs").update(payload).eq("id", editing.id)
      : await supabase.from("fixed_costs").insert({ ...payload, family_id: familyId });

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
      .from("fixed_costs")
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
      title={(editing ? "항목 수정" : "항목 추가") + (isPrivateRecord ? " · 🔒 내 예산" : "")}
      widthClass="sm:max-w-lg"
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>용도</Label>
          <div className="flex flex-wrap gap-1.5">
            {FC_PURPOSES.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setPurpose(p.key)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  purpose === p.key
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-card text-muted-foreground hover:bg-muted",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="fcName">이름</Label>
            <Input
              id="fcName"
              placeholder="예: 월세, 주택청약"
              maxLength={50}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fcAmount">금액</Label>
            <Input
              id="fcAmount"
              inputMode="numeric"
              placeholder="₩ 0"
              className="text-right"
              value={amountText ? `₩ ${amountText}` : ""}
              onChange={(e) => setAmountText(formatAmountInput(e.target.value))}
            />
          </div>
        </div>

        <div className={cn("grid gap-3", isPrivateRecord ? "sm:grid-cols-2" : "sm:grid-cols-3")}>
          {!isPrivateRecord && (
          <div className="space-y-2">
            <Label>구분</Label>
            <SelectBox
              value={memberUserId}
              onChange={setMemberUserId}
              placeholder="공동"
              options={[
                { value: "", label: "공동" },
                ...members.map((m) => ({
                  value: m.user_id,
                  label: m.display_name,
                  dot: m.color,
                })),
              ]}
            />
          </div>
          )}
          <div className="space-y-2">
            <Label>주기</Label>
            <SelectBox value={cycle} onChange={setCycle} options={FC_CYCLES} />
          </div>
          <div className="space-y-2">
            <Label>납부일</Label>
            <SelectBox value={dueDay} onChange={setDueDay} options={DUE_DAY_OPTIONS} />
          </div>
        </div>

        <div className="space-y-2">
          <Label>자산</Label>
          <SelectBox
            value={assetId}
            onChange={setAssetId}
            placeholder="분배할 자산 선택"
            options={assetOptions}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="fcStart">시작일</Label>
            <Input
              id="fcStart"
              type="date"
              value={startOn}
              onChange={(e) => setStartOn(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fcEnd">
              종료일 <span className="font-normal text-muted-foreground">(선택)</span>
            </Label>
            <Input
              id="fcEnd"
              type="date"
              value={endOn}
              onChange={(e) => setEndOn(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="fcMemo">메모 (선택)</Label>
          <Input
            id="fcMemo"
            placeholder="예: 2027년 3월 만기"
            maxLength={100}
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
          />
        </div>

        {editing && (
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 accent-[hsl(var(--primary))]"
            />
            활성 (해지한 구독 등은 체크 해제)
          </label>
        )}

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
            {editing ? "저장" : "추가"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
