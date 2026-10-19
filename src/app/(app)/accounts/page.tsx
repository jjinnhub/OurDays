import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AssetsView } from "@/components/assets/assets-view";
import { getUserAndMembership } from "@/lib/family";
import { createClient } from "@/lib/supabase/server";
import type { Asset, FamilyMemberLite } from "@/lib/asset-constants";

export const metadata: Metadata = { title: "자산" };

export default async function AssetsPage() {
  const { user, membership } = await getUserAndMembership();
  if (!user || !membership) redirect("/login");

  const supabase = await createClient();
  const [{ data: assetRows }, { data: memberRows }, { data: canEdit }] = await Promise.all([
    supabase
      .from("assets")
      .select("id, group_key, institution, name, amount, owner_user_id, memo, balance_date, maturity_on, is_private")
      .eq("family_id", membership.family_id)
      .eq("is_archived", false)
      .order("created_at", { ascending: true }),
    supabase
      .from("family_members")
      .select("user_id, display_name, color")
      .eq("family_id", membership.family_id),
    supabase.rpc("can_edit_module", {
      p_family_id: membership.family_id,
      p_module: "assets",
    }),
  ]);

  return (
    <AssetsView
      familyId={membership.family_id}
      currentUserId={user.id}
      assets={(assetRows as Asset[] | null) ?? []}
      members={(memberRows as FamilyMemberLite[] | null) ?? []}
      canEdit={Boolean(canEdit)}
    />
  );
}
