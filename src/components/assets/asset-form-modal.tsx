"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { InstitutionSelect } from "@/components/assets/institution-select";
import { SelectBox } from "@/components/ui/select-box";
import {
  ASSET_GROUPS,
  type Asset,
  type AssetGroupKey,
  type FamilyMemberLite,
} from "@/lib/asset-constants";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onClose: () => void;
  familyId: string;
  currentUserId: string;
  members: FamilyMemberLite[];
  /** null이면 신규 등록 */
  editing: Asset | null;
  /** '내 자산' 탭에서 열면 기본값을 나만 보기로 */
  defaultPrivate?: boolean;
};

function formatAmountInput(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, "");
  if (!digits) return "";
  return Number(digits).toLocaleString("ko-KR");
}

export function AssetFormModal({
  open,
  onClose,
  familyId,
  currentUserId,
  members,
  editing,
  defaultPrivate = false,
}: Props) {
  const router = useRouter();
  const [groupKey, setGroupKey] = useState<AssetGroupKey>("bank");
  const [institution, setInstitution] = useState("");
  const [name, setName] = useState("");
  const [amountText, setAmountText] = useState("");
  const [ownerUserId, setOwnerUserId] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [maturityOn, setMaturityOn] = useState("");
  const [memo, setMemo] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setGroupKey(editing?.group_key ?? "bank");
    setInstitution(editing?.institution ?? "");
    setName(editing?.name ?? "");
    setAmountText(editing ? Number(editing.amount).toLocaleString("ko-KR") : "");
    setOwnerUserId(editing?.owner_user_id ?? "");
    setIsPrivate(editing?.is_private ?? defaultPrivate);
    setMaturityOn(editing?.maturity_on ?? "");
    setMemo(editing?.memo ?? "");
    setConfirmDelete(false);
    setError(null);
  }, [open, editing, defaultPrivate]);

  async function save() {
    if (!name.trim()) {
      setError("자산 이름을 입력해 주세요.");
      return;
    }
    if (amountText.trim() === "") {
      setError("금액을 입력해 주세요.");
      return;
    }
    setSaving(true);
    setError(null);

    const supabase = createClient();
    const payload = {
      group_key: groupKey,
      institution: institution.trim(),
      name: name.trim(),
      amount: Number(amountText.replace(/[^0-9]/g, "")),
      owner_user_id: isPrivate ? currentUserId : ownerUserId || null,
      is_private: isPrivate,
      maturity_on: groupKey === "savings" && maturityOn ? maturityOn : null,
      memo: memo.trim(),
    };

    const { error: dbError } = editing
      ? await supabase.from("assets").update(payload).eq("id", editing.id)
      : await supabase.from("assets").insert({ ...payload, family_id: familyId });

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
    const { error: dbError } = await supabase.from("assets").delete().eq("id", editing.id);
    setDeleting(false);
    if (dbError) {
      setError(dbError.message);
      return;
    }
    onClose();
    router.refresh();
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? "자산 수정" : "자산 추가"} widthClass="sm:max-w-lg">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>그룹</Label>
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
            {ASSET_GROUPS.map((g) => (
              <button
                key={g.key}
                type="button"
                onClick={() => setGroupKey(g.key)}
                className={cn(
                  "whitespace-nowrap rounded-lg border px-1.5 py-2 text-xs font-medium transition-colors",
                  groupKey === g.key
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-card text-muted-foreground hover:bg-muted",
                )}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>공개 범위</Label>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => setIsPrivate(false)}
              className={cn(
                "rounded-lg border py-2 text-sm font-medium transition-colors",
                !isPrivate
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground hover:bg-muted",
              )}
            >
              🏡 가족 공동
            </button>
            <button
              type="button"
              onClick={() => setIsPrivate(true)}
              className={cn(
                "rounded-lg border py-2 text-sm font-medium transition-colors",
                isPrivate
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground hover:bg-muted",
              )}
            >
              🔒 나만 보기
            </button>
          </div>
          {isPrivate && (
            <p className="text-xs text-muted-foreground">
              이 자산은 나에게만 보이고, 명의자는 자동으로 나로 지정돼요. 가족
              순자산·통계에는 포함되지 않아요.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label>은행/투자사</Label>
          <InstitutionSelect value={institution} onChange={setInstitution} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="assetName">자산 이름</Label>
          <Input
            id="assetName"
            placeholder="예: 생활비 통장, 주택청약"
            maxLength={50}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="assetAmount">금액 (원)</Label>
          <Input
            id="assetAmount"
            inputMode="numeric"
            placeholder="₩ 0"
            className="text-right"
            value={amountText ? `₩ ${amountText}` : ""}
            onChange={(e) => setAmountText(formatAmountInput(e.target.value))}
          />
        </div>

        {!isPrivate && (
        <div className="space-y-2">
          <Label>명의자 (선택)</Label>
          <SelectBox
            value={ownerUserId}
            onChange={setOwnerUserId}
            placeholder="선택 안 함"
            options={[
              { value: "", label: "선택 안 함" },
              ...members.map((m) => ({
                value: m.user_id,
                label: m.display_name,
                dot: m.color,
              })),
            ]}
          />
        </div>
        )}

        {groupKey === "savings" && (
          <div className="space-y-2">
            <Label htmlFor="assetMaturity">
              만기일 <span className="font-normal text-muted-foreground">(선택)</span>
            </Label>
            <Input
              id="assetMaturity"
              type="date"
              value={maturityOn}
              onChange={(e) => setMaturityOn(e.target.value)}
            />
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="assetMemo">메모 (선택)</Label>
          <Input
            id="assetMemo"
            placeholder="예: 끝자리 1234, 월급 통장"
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
            {editing ? "저장" : "추가"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
