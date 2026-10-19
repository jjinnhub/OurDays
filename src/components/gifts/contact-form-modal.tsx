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
  GIFT_RELATIONS,
  type Contact,
  type GiftRelationKey,
} from "@/lib/gift-constants";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onClose: () => void;
  familyId: string;
  members: FamilyMemberLite[];
  editing: Contact | null;
  recordCount?: number;
};

export function ContactFormModal({
  open,
  onClose,
  familyId,
  members,
  editing,
  recordCount = 0,
}: Props) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [relation, setRelation] = useState<GiftRelationKey>("friend");
  const [organization, setOrganization] = useState("");
  const [ownerUserId, setOwnerUserId] = useState("");
  const [memo, setMemo] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? "");
    setRelation(editing?.relation ?? "friend");
    setOrganization(editing?.organization ?? "");
    setOwnerUserId(editing?.owner_user_id ?? "");
    setMemo(editing?.memo ?? "");
    setConfirmDelete(false);
    setError(null);
  }, [open, editing]);

  async function save() {
    if (!name.trim()) {
      setError("이름을 입력해 주세요.");
      return;
    }
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const payload = {
      name: name.trim(),
      relation,
      organization: organization.trim(),
      owner_user_id: ownerUserId || null,
      memo: memo.trim(),
    };
    const { error: dbError } = editing
      ? await supabase.from("contacts").update(payload).eq("id", editing.id)
      : await supabase.from("contacts").insert({ ...payload, family_id: familyId });
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
      .from("contacts")
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
      title={editing ? "관계인 수정" : "관계인 추가"}
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="ctName">이름</Label>
          <Input
            id="ctName"
            placeholder="예: 김철수, 철수네"
            maxLength={30}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>관계</Label>
          <div className="flex flex-wrap gap-1.5">
            {GIFT_RELATIONS.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => setRelation(r.key)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  relation === r.key
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-card text-muted-foreground hover:bg-muted",
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="ctOrg">소속 (선택)</Label>
          <Input
            id="ctOrg"
            placeholder="예: OO회사, 대학 동기"
            maxLength={50}
            value={organization}
            onChange={(e) => setOrganization(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>누구의 지인인가요?</Label>
          <SelectBox
            value={ownerUserId}
            onChange={setOwnerUserId}
            placeholder="가족 공통"
            options={[
              { value: "", label: "가족 공통" },
              ...members.map((m) => ({
                value: m.user_id,
                label: m.display_name,
                dot: m.color,
              })),
            ]}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="ctMemo">메모 (선택)</Label>
          <Input
            id="ctMemo"
            placeholder="예: 연락처, 계좌번호 끝자리"
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
                기록 {recordCount}건과 함께 삭제
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
