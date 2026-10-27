import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ShoppingView } from "@/components/shopping/shopping-view";
import type { FamilyMemberLite } from "@/lib/asset-constants";
import type { ShoppingItem, ShoppingList } from "@/lib/shopping-constants";
import { getUserAndMembership } from "@/lib/family";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "장바구니" };

export default async function ShoppingPage() {
  const { user, membership } = await getUserAndMembership();
  if (!user || !membership) redirect("/login");

  const supabase = await createClient();
  const [{ data: listRows }, { data: itemRows }, { data: memberRows }, { data: canEdit }] =
    await Promise.all([
      supabase
        .from("shopping_lists")
        .select("id, family_id, name, created_by, created_at")
        .eq("family_id", membership.family_id)
        .order("created_at", { ascending: true }),
      supabase
        .from("shopping_items")
        .select(
          "id, list_id, family_id, name, quantity, memo, created_by, checked_by, checked_at, created_at",
        )
        .eq("family_id", membership.family_id)
        .order("created_at", { ascending: true }),
      supabase
        .from("family_members")
        .select("user_id, display_name, color")
        .eq("family_id", membership.family_id),
      supabase.rpc("can_edit_module", {
        p_family_id: membership.family_id,
        p_module: "shopping",
      }),
    ]);

  return (
    <ShoppingView
      familyId={membership.family_id}
      currentUserId={user.id}
      initialLists={(listRows as ShoppingList[] | null) ?? []}
      initialItems={(itemRows as ShoppingItem[] | null) ?? []}
      members={(memberRows as FamilyMemberLite[] | null) ?? []}
      canEdit={Boolean(canEdit)}
    />
  );
}
