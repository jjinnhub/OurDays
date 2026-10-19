"use client";

import { useEffect, useState } from "react";
import { UserPlus, X } from "lucide-react";

const DISMISS_KEY = "ourdays:invite-banner-dismissed";

export function InviteBanner({ inviteCode }: { inviteCode: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      setVisible(window.localStorage.getItem(DISMISS_KEY) !== "1");
    } catch {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  function dismiss() {
    setVisible(false);
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // 저장 실패는 무시 (다음 방문 때 다시 보임)
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-accent/40 bg-accent/15 px-4 py-3 text-sm">
      <div className="flex items-center gap-3">
        <UserPlus className="h-4 w-4 shrink-0 text-accent-foreground" />
        <p>
          아직 혼자네요! 초대코드{" "}
          <span className="font-semibold tracking-wider">{inviteCode}</span> 를 가족에게
          공유해 보세요.
        </p>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="배너 닫기"
        className="text-muted-foreground hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
