import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LogoutButton } from "@/components/auth/logout-button";
import { ChangeColorSection } from "@/components/settings/change-color-section";
import { DeleteFamilySection } from "@/components/settings/delete-family-section";
import { MemberPermissionsSection } from "@/components/settings/member-permissions-section";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getUserAndMembership } from "@/lib/family";
import type { MemberPermission } from "@/lib/permission-constants";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "설정" };

export default async function SettingsPage() {
  const { user, membership } = await getUserAndMembership();
  if (!user || !membership) redirect("/login");

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("name")
    .eq("id", user.id)
    .maybeSingle();
  const userName =
    (profile as { name: string } | null)?.name || membership.display_name;

  const { data: memberRows } = await supabase
    .from("family_members")
    .select("user_id, display_name, color, role")
    .eq("family_id", membership.family_id)
    .order("created_at", { ascending: true });
  const members =
    (memberRows as
      | { user_id: string; display_name: string; color: string; role: string }[]
      | null) ?? [];
  const memberCount = members.length || 1;
  const usedByOthers = members
    .filter((m) => m.user_id !== user.id)
    .map((m) => m.color);

  const isOwner = membership.role === "owner";
  let permissionRows: MemberPermission[] = [];
  let memberNames = new Map<string, string>();
  if (isOwner) {
    const [{ data: permData }, { data: profData }] = await Promise.all([
      supabase
        .from("member_permissions")
        .select("user_id, module, can_edit")
        .eq("family_id", membership.family_id),
      supabase
        .from("profiles")
        .select("id, name")
        .in("id", members.map((m) => m.user_id)),
    ]);
    permissionRows = (permData as MemberPermission[] | null) ?? [];
    memberNames = new Map(
      ((profData as { id: string; name: string }[] | null) ?? []).map((p) => [
        p.id,
        p.name,
      ]),
    );
  }

  return (
    <div className="max-w-xl space-y-4">
      <h1 className="text-2xl font-bold">설정</h1>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">내 정보</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center gap-3">
            <span
              className="flex h-10 w-10 items-center justify-center rounded-full font-semibold text-white"
              style={{ backgroundColor: membership.color }}
            >
              {userName.slice(0, 1)}
            </span>
            <div>
              <p className="font-medium">{userName}</p>
              <p className="text-muted-foreground">
                {membership.display_name} · {user.email}
              </p>
            </div>
          </div>
          <ChangeColorSection
            familyId={membership.family_id}
            currentColor={membership.color}
            usedColors={usedByOthers}
          />
          <p className="text-xs text-muted-foreground">호칭 변경은 준비 중이에요.</p>
          <LogoutButton />
        </CardContent>
      </Card>

      {isOwner && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">구성원 권한</CardTitle>
          </CardHeader>
          <CardContent>
            <MemberPermissionsSection
              familyId={membership.family_id}
              members={members.map((m) => ({
                ...m,
                name: memberNames.get(m.user_id) ?? "",
              }))}
              permissions={permissionRows}
            />
          </CardContent>
        </Card>
      )}

      {isOwner && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">가족 관리</CardTitle>
          </CardHeader>
          <CardContent>
            <DeleteFamilySection
              familyId={membership.family_id}
              familyName={membership.families.name}
              memberCount={memberCount}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
