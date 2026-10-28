import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PlacesView } from "@/components/places/places-view";
import type { FamilyMemberLite } from "@/lib/asset-constants";
import type { Place, PlaceCategory } from "@/lib/place-constants";
import { getUserAndMembership } from "@/lib/family";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "여기어때" };

export default async function PlacesPage() {
  const { user, membership } = await getUserAndMembership();
  if (!user || !membership) redirect("/login");

  const supabase = await createClient();
  const [{ data: categoryRows }, { data: placeRows }, { data: memberRows }, { data: canEdit }] =
    await Promise.all([
      supabase
        .from("place_categories")
        .select("id, family_id, name, icon, sort_order, created_at")
        .eq("family_id", membership.family_id)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
      supabase
        .from("places")
        .select(
          "id, family_id, category_id, name, address, lat, lng, status, memo, kakao_place_id, kakao_url, created_by, created_at",
        )
        .eq("family_id", membership.family_id)
        .order("created_at", { ascending: false }),
      supabase
        .from("family_members")
        .select("user_id, display_name, color")
        .eq("family_id", membership.family_id),
      supabase.rpc("can_edit_module", {
        p_family_id: membership.family_id,
        p_module: "places",
      }),
    ]);

  return (
    <PlacesView
      familyId={membership.family_id}
      initialCategories={(categoryRows as PlaceCategory[] | null) ?? []}
      initialPlaces={(placeRows as Place[] | null) ?? []}
      members={(memberRows as FamilyMemberLite[] | null) ?? []}
      canEdit={Boolean(canEdit)}
    />
  );
}
