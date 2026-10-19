"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

type Props = {
  familyId: string;
  familyName: string;
  memberCount: number;
};

export function DeleteFamilySection({ familyId, familyName, memberCount }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const matched = confirmText.trim() === familyName;

  async function deleteFamily() {
    if (!matched || loading) return;
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("delete_family", {
      p_family_id: familyId,
    });

    if (rpcError) {
      setLoading(false);
      setError(
        rpcError.message.includes("FORBIDDEN")
          ? "가족 해체는 대표만 할 수 있어요."
          : rpcError.message,
      );
      return;
    }

    // 멤버십이 사라졌으므로 온보딩으로
    router.replace("/onboarding");
    router.refresh();
  }

  if (!open) {
    return (
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">가족 해체</p>
          <p className="text-xs text-muted-foreground">
            가족과 모든 공유 데이터가 삭제되며 되돌릴 수 없어요.
          </p>
        </div>
        <Button variant="outline" size="sm" className="shrink-0 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setOpen(true)}>
          해체하기
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
      <div className="flex gap-3">
        <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
        <div className="space-y-1 text-sm">
          <p className="font-semibold text-destructive">
            정말 &lsquo;{familyName}&rsquo; 가족을 해체할까요?
          </p>
          <ul className="list-disc space-y-0.5 pl-4 text-muted-foreground">
            <li>구성원 {memberCount}명 모두 가족에서 나가게 돼요.</li>
            <li>가족에 기록된 모든 데이터가 삭제돼요.</li>
            <li>이 작업은 되돌릴 수 없어요.</li>
          </ul>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmFamilyName" className="text-sm">
          확인을 위해 가족 이름 <span className="font-semibold">{familyName}</span> 을(를)
          입력해 주세요
        </Label>
        <Input
          id="confirmFamilyName"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder={familyName}
          autoComplete="off"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={() => {
            setOpen(false);
            setConfirmText("");
            setError(null);
          }}
        >
          취소
        </Button>
        <Button
          variant="destructive"
          size="sm"
          className="flex-1"
          disabled={!matched || loading}
          onClick={deleteFamily}
        >
          {loading && <Loader2 className="animate-spin" />}
          가족 해체
        </Button>
      </div>
    </div>
  );
}
