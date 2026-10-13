"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Link2, Loader2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

type Props = {
  familyId: string;
  inviteCode: string;
  inviteExpiresAt: string;
  canRegenerate: boolean;
};

export function InviteCodeBox({ familyId, inviteCode, inviteExpiresAt, canRegenerate }: Props) {
  const router = useRouter();
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  const expires = new Date(inviteExpiresAt);
  const valid = expires.getTime() > Date.now();

  async function copy(text: string, kind: "code" | "link") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // clipboard 미지원 환경은 무시
    }
  }

  async function regenerate() {
    setRegenerating(true);
    const supabase = createClient();
    await supabase.rpc("regenerate_invite_code", { p_family_id: familyId });
    setRegenerating(false);
    router.refresh();
  }

  return (
    <div className="space-y-1.5 rounded-lg border bg-muted/40 p-2.5">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm font-semibold tracking-[0.25em]">{inviteCode}</span>
          <span className="ml-2 text-xs text-muted-foreground">
            {valid
              ? `${expires.toLocaleDateString("ko-KR", { month: "long", day: "numeric" })}까지`
              : "만료됨"}
          </span>
        </div>
        {canRegenerate && (
          <Button
            variant="ghost"
            size="sm"
            onClick={regenerate}
            disabled={regenerating}
            aria-label="초대코드 재발급"
          >
            {regenerating ? <Loader2 className="animate-spin" /> : <RefreshCw />}
          </Button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" size="sm" onClick={() => copy(inviteCode, "code")}>
          {copied === "code" ? <Check /> : <Copy />}
          {copied === "code" ? "복사됨" : "코드 복사"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => copy(`${window.location.origin}/invite/${inviteCode}`, "link")}
        >
          {copied === "link" ? <Check /> : <Link2 />}
          {copied === "link" ? "복사됨" : "링크 복사"}
        </Button>
      </div>
    </div>
  );
}
