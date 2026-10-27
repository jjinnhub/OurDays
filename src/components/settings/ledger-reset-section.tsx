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
  /** 가계부 편집 권한 보유 여부 (가족 초기화 노출 조건) */
  canResetFamily: boolean;
};

type Scope = "family" | "personal";

export function LedgerResetSection({ familyId, canResetFamily }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState<Scope | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(scope: Scope) {
    if (busy) return;
    setBusy(true);
    setError(null);
    setResult(null);

    const supabase = createClient();
    const { data, error: rpcError } = await supabase.rpc(
      scope === "family" ? "reset_family_ledger" : "reset_personal_ledger",
      { p_family_id: familyId },
    );
    setBusy(false);
    if (rpcError) {
      setError(
        rpcError.message.includes("FORBIDDEN")
          ? "초기화 권한이 없어요."
          : rpcError.message,
      );
      return;
    }
    setOpen(null);
    setConfirmText("");
    setResult(
      `${scope === "family" ? "가족" : "개인"} 가계부 기록 ${Number(data ?? 0)}건을 삭제했어요.`,
    );
    router.refresh();
  }

  function ResetBlock({
    scope,
    title,
    description,
  }: {
    scope: Scope;
    title: string;
    description: string;
  }) {
    const isOpen = open === scope;
    const matched = scope === "personal" || confirmText.trim() === "초기화";

    if (!isOpen) {
      return (
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">{title}</p>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => {
              setOpen(scope);
              setConfirmText("");
              setError(null);
              setResult(null);
            }}
          >
            초기화
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
        <div className="flex gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
          <div className="space-y-1 text-sm">
            <p className="font-semibold text-destructive">
              {scope === "family"
                ? "가족 가계부의 모든 거래 기록이 삭제돼요."
                : "내 개인 가계부의 모든 거래 기록이 삭제돼요."}
            </p>
            <ul className="list-disc space-y-0.5 pl-4 text-muted-foreground">
              <li>삭제되는 거래만큼 자산 잔액도 함께 되돌려져요. (카테고리는 유지)</li>
              {scope === "family" && (
                <li>구성원들의 개인 가계부 기록은 삭제되지 않아요.</li>
              )}
              <li>이 작업은 되돌릴 수 없어요.</li>
            </ul>
          </div>
        </div>

        {scope === "family" && (
          <div className="space-y-2">
            <Label htmlFor="resetConfirm" className="text-sm">
              확인을 위해 <span className="font-semibold">초기화</span> 를 입력해
              주세요
            </Label>
            <Input
              id="resetConfirm"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="초기화"
              autoComplete="off"
            />
          </div>
        )}

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => {
              setOpen(null);
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
            disabled={!matched || busy}
            onClick={() => run(scope)}
          >
            {busy && <Loader2 className="animate-spin" />}
            {scope === "family" ? "가족 가계부 초기화" : "개인 가계부 초기화"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {canResetFamily && (
        <ResetBlock
          scope="family"
          title="가족 가계부 초기화"
          description="공동 거래 기록 전체를 삭제하고 자산 잔액을 되돌려요."
        />
      )}
      <ResetBlock
        scope="personal"
        title="개인 가계부 초기화"
        description="나만 보는 거래 기록 전체를 삭제하고 자산 잔액을 되돌려요."
      />
      {result && <p className="text-sm text-secondary-foreground">{result}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
