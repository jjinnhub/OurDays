import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LogoutButton } from "@/components/auth/logout-button";
import { InviteCodeBox } from "@/components/dashboard/family-widget";
import { BrandLogo } from "@/components/brand-logo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getUserAndMembership } from "@/lib/family";
import { createClient, hasSupabaseEnv } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "홈" };

type MemberRow = {
  user_id: string;
  role: string;
  display_name: string;
  color: string;
};

export default async function DashboardPage() {
  if (!hasSupabaseEnv()) redirect("/login");

  const { user, membership } = await getUserAndMembership();
  if (!user) redirect("/login");
  if (!membership) redirect("/onboarding");

  const supabase = await createClient();
  const { data } = await supabase
    .from("family_members")
    .select("user_id, role, display_name, color")
    .eq("family_id", membership.family_id)
    .order("created_at", { ascending: true });
  const members = (data as MemberRow[] | null) ?? [];
  const canRegenerate = membership.role === "owner" || membership.role === "admin";

  return (
    <main className="container max-w-2xl space-y-6 py-8">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BrandLogo size={56} showWordmark={false} className="shrink-0" />
          <div>
            <h1 className="text-xl font-bold">{membership.families.name}</h1>
            <p className="text-sm text-muted-foreground">
              {membership.display_name} 님, 어서 오세요
            </p>
          </div>
        </div>
        <LogoutButton />
      </header>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">우리 가족</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ul className="space-y-2">
            {members.map((m) => (
              <li key={m.user_id} className="flex items-center gap-3 text-sm">
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: m.color }}
                />
                <span className="font-medium">{m.display_name}</span>
                {m.user_id === user.id && (
                  <span className="text-xs text-muted-foreground">(나)</span>
                )}
                {m.role === "owner" && (
                  <span className="rounded-full bg-accent/30 px-2 py-0.5 text-xs text-accent-foreground">
                    대표
                  </span>
                )}
              </li>
            ))}
          </ul>
          <InviteCodeBox
            familyId={membership.family_id}
            inviteCode={membership.families.invite_code}
            inviteExpiresAt={membership.families.invite_expires_at}
            canRegenerate={canRegenerate}
          />
        </CardContent>
      </Card>

      <p className="text-center text-sm text-muted-foreground">
        가계부·자산 등 나머지 기능은 다음 단계에서 이어서 이식합니다.
      </p>
    </main>
  );
}
