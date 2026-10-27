import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { MealsView } from "@/components/meals/meals-view";
import type { MealCategory } from "@/lib/meal-constants";
import { getUserAndMembership } from "@/lib/family";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "식단표" };

export default async function MealsPage() {
  const { user, membership } = await getUserAndMembership();
  if (!user || !membership) redirect("/login");

  const supabase = await createClient();
  const [{ data: categoryRows }, { data: recentRows }, { data: canEdit }] =
    await Promise.all([
      supabase
        .from("meal_categories")
        .select("id, family_id, name, color, sort_order, created_at")
        .eq("family_id", membership.family_id)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
      // 메뉴 자동완성용 최근 메뉴명 (중복 제거는 클라이언트에서)
      supabase
        .from("meal_entries")
        .select("name, category_id")
        .eq("family_id", membership.family_id)
        .order("created_at", { ascending: false })
        .limit(500),
      supabase.rpc("can_edit_module", {
        p_family_id: membership.family_id,
        p_module: "meals",
      }),
    ]);

  return (
    <MealsView
      familyId={membership.family_id}
      initialCategories={(categoryRows as MealCategory[] | null) ?? []}
      recentEntries={
        (recentRows as { name: string; category_id: string | null }[] | null) ?? []
      }
      canEdit={Boolean(canEdit)}
    />
  );
}
