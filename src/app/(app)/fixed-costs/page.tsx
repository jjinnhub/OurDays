import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { FixedCostsView } from "@/components/fixed-costs/fixed-costs-view";
import type { FamilyMemberLite } from "@/lib/asset-constants";
import type { FcOccurrence, FixedCost } from "@/lib/fixed-cost-constants";
import type { AssetLite } from "@/lib/ledger-constants";
import { getUserAndMembership } from "@/lib/family";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "월 예산" };

export default async function FixedCostsPage() {
  const { user, membership } = await getUserAndMembership();
  if (!user || !membership) redirect("/login");

  const supabase = await createClient();

  // 이번 달 + 다음 달 발생분 지연 생성
  await supabase.rpc("ensure_fixed_cost_occurrences", {
    p_family_id: membership.family_id,
  });

  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const nextMonthStart = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-01`;

  const [
    { data: fcRows },
    { data: occRows },
    { data: memberRows },
    { data: assetRows },
    { data: canEdit },
    { data: budgetRow },
    { data: personalBudgetRow },
  ] = await Promise.all([
    supabase
      .from("fixed_costs")
      .select(
        "id, name, amount, purpose, cycle_months, due_day, member_user_id, asset_id, to_asset_id, category_id, memo, start_on, end_on, is_active, is_private",
      )
      .eq("family_id", membership.family_id)
      .order("due_day", { ascending: true }),
    // 이번 달 전체 + 지난 미납
    supabase
      .from("fixed_cost_occurrences")
      .select("id, fixed_cost_id, due_on, amount, status, paid_on")
      .eq("family_id", membership.family_id)
      .lt("due_on", nextMonthStart)
      .or(`due_on.gte.${monthStart},status.eq.pending`)
      .order("due_on", { ascending: true }),
    supabase
      .from("family_members")
      .select("user_id, display_name, color")
      .eq("family_id", membership.family_id),
    supabase
      .from("assets")
      .select("id, name, institution, group_key, is_private")
      .eq("family_id", membership.family_id)
      .eq("is_archived", false),
    supabase.rpc("can_edit_module", {
      p_family_id: membership.family_id,
      p_module: "fixed_costs",
    }),
    supabase
      .from("budget_settings")
      .select("expected_income")
      .eq("family_id", membership.family_id)
      .maybeSingle(),
    supabase
      .from("personal_budget_settings")
      .select("expected_income")
      .eq("family_id", membership.family_id)
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  return (
    <FixedCostsView
      familyId={membership.family_id}
      fixedCosts={(fcRows as FixedCost[] | null) ?? []}
      occurrences={(occRows as FcOccurrence[] | null) ?? []}
      members={(memberRows as FamilyMemberLite[] | null) ?? []}
      assets={(assetRows as AssetLite[] | null) ?? []}
      canEdit={Boolean(canEdit)}
      currentUserId={user.id}
      expectedIncome={Number(
        (budgetRow as { expected_income: number | string } | null)?.expected_income ?? 0,
      )}
      expectedIncomePersonal={Number(
        (personalBudgetRow as { expected_income: number | string } | null)
          ?.expected_income ?? 0,
      )}
    />
  );
}
