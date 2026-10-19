import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { GiftsView } from "@/components/gifts/gifts-view";
import type { FamilyMemberLite } from "@/lib/asset-constants";
import type { Contact, GiftRecord } from "@/lib/gift-constants";
import { getUserAndMembership } from "@/lib/family";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "축의금" };

export default async function GiftsPage() {
  const { user, membership } = await getUserAndMembership();
  if (!user || !membership) redirect("/login");

  const supabase = await createClient();
  const [{ data: contactRows }, { data: recordRows }, { data: memberRows }, { data: canEdit }] =
    await Promise.all([
      supabase
        .from("contacts")
        .select("id, name, relation, organization, owner_user_id, memo")
        .eq("family_id", membership.family_id)
        .order("name", { ascending: true }),
      supabase
        .from("gift_records")
        .select("id, contact_id, event_type, direction, amount, occurred_on, attended, memo")
        .eq("family_id", membership.family_id)
        .order("occurred_on", { ascending: false }),
      supabase
        .from("family_members")
        .select("user_id, display_name, color")
        .eq("family_id", membership.family_id),
      supabase.rpc("can_edit_module", {
        p_family_id: membership.family_id,
        p_module: "gifts",
      }),
    ]);

  return (
    <GiftsView
      familyId={membership.family_id}
      contacts={(contactRows as Contact[] | null) ?? []}
      records={(recordRows as GiftRecord[] | null) ?? []}
      members={(memberRows as FamilyMemberLite[] | null) ?? []}
      canEdit={Boolean(canEdit)}
    />
  );
}
