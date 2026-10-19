"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

import {
  PERMISSION_MODULES,
  type MemberPermission,
  type PermissionModuleKey,
} from "@/lib/permission-constants";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type MemberRow = {
  user_id: string;
  display_name: string;
  color: string;
  role: string;
  name: string;
};

type Props = {
  familyId: string;
  members: MemberRow[];
  permissions: MemberPermission[];
};

export function MemberPermissionsSection({ familyId, members, permissions }: Props) {
  // "user_id:module" -> can_edit
  const [grants, setGrants] = useState<Set<string>>(
    () =>
      new Set(
        permissions.filter((p) => p.can_edit).map((p) => `${p.user_id}:${p.module}`),
      ),
  );
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const managed = members.filter((m) => m.role === "member" || m.role === "viewer");

  async function toggle(userId: string, module: PermissionModuleKey) {
    const key = `${userId}:${module}`;
    if (pending) return;
    const next = !grants.has(key);
    setPending(key);
    setError(null);

    const supabase = createClient();
    const { error: dbError } = await supabase.from("member_permissions").upsert({
      family_id: familyId,
      user_id: userId,
      module,
      can_edit: next,
    });

    setPending(null);
    if (dbError) {
      setError(dbError.message);
      return;
    }
    setGrants((prev) => {
      const copy = new Set(prev);
      if (next) copy.add(key);
      else copy.delete(key);
      return copy;
    });
  }

  if (managed.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        권한을 관리할 구성원이 아직 없어요. 가족이 참가하면 여기에서 편집 권한을 줄 수
        있어요.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        켜진 메뉴만 해당 구성원이 추가·수정·삭제할 수 있어요. 꺼져 있으면 보기만
        가능해요. (대표는 항상 모든 권한을 가져요)
      </p>
      {managed.map((m) => (
        <div key={m.user_id} className="space-y-2 rounded-lg border p-3">
          <div className="flex items-center gap-2 text-sm">
            <span
              className="h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: m.color }}
            />
            <span className="font-medium">{m.name || m.display_name}</span>
            <span className="text-xs text-muted-foreground">{m.display_name}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {PERMISSION_MODULES.map((mod) => {
              const key = `${m.user_id}:${mod.key}`;
              const on = grants.has(key);
              const busy = pending === key;
              return (
                <button
                  key={mod.key}
                  type="button"
                  disabled={busy}
                  onClick={() => toggle(m.user_id, mod.key)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                    on
                      ? "border-primary bg-primary text-primary-foreground"
                      : "bg-card text-muted-foreground hover:bg-muted",
                  )}
                >
                  {busy && <Loader2 className="h-3 w-3 animate-spin" />}
                  {mod.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
