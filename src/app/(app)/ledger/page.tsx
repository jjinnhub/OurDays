import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LedgerView } from "@/components/ledger/ledger-view";
import type { FamilyMemberLite } from "@/lib/asset-constants";
import type { AssetLite, Category, FlowTx, InboundTransfer, Transaction, TransferTarget } from "@/lib/ledger-constants";
import { getUserAndMembership } from "@/lib/family";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "가계부" };

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default async function LedgerPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; add?: string; asset?: string; tab?: string }>;
}) {
  const { user, membership } = await getUserAndMembership();
  if (!user || !membership) redirect("/login");

  const params = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(params.month ?? "")
    ? params.month!
    : currentMonth();

  const [y, m] = month.split("-").map(Number);
  const start = `${month}-01`;
  const end = `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}-01`;

  const supabase = await createClient();
  const [
    { data: txRows },
    { data: categoryRows },
    { data: assetRows },
    { data: memberRows },
    { data: canEdit },
    { data: targetRows },
    { data: flowRows },
    { data: inboundRows },
  ] = await Promise.all([
    supabase
      .from("transactions")
      .select(
        "id, type, title, amount, occurred_on, category_id, asset_id, to_asset_id, member_user_id, memo, recur_group_id, recur_rule, is_private",
      )
      .eq("family_id", membership.family_id)
      .is("deleted_at", null)
      .gte("occurred_on", start)
      .lt("occurred_on", end)
      .order("occurred_on", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("categories")
      .select("id, type, name, icon, color, sort_order")
      .eq("family_id", membership.family_id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("assets")
      .select("id, name, institution, group_key, is_private, amount")
      .eq("family_id", membership.family_id)
      .eq("is_archived", false)
      .order("created_at", { ascending: true }),
    supabase
      .from("family_members")
      .select("user_id, display_name, color")
      .eq("family_id", membership.family_id),
    supabase.rpc("can_edit_module", {
      p_family_id: membership.family_id,
      p_module: "ledger",
    }),
    supabase.rpc("list_transfer_targets", {
      p_family_id: membership.family_id,
    }),
    supabase
      .from("transactions")
      .select("type, amount, occurred_on, asset_id, to_asset_id, is_private")
      .eq("family_id", membership.family_id)
      .is("deleted_at", null),
    supabase.rpc("list_shared_inbound_transfers", {
      p_family_id: membership.family_id,
    }),
  ]);

  return (
    <LedgerView
      familyId={membership.family_id}
      currentUserId={user.id}
      month={month}
      transactions={(txRows as Transaction[] | null) ?? []}
      categories={(categoryRows as Category[] | null) ?? []}
      assets={(assetRows as AssetLite[] | null) ?? []}
      members={(memberRows as FamilyMemberLite[] | null) ?? []}
      canEdit={Boolean(canEdit)}
      openOnMount={params.add === "1"}
      initialAssetFilter={params.asset ?? ""}
      initialTab={params.tab === "personal" ? "personal" : "family"}
      transferTargets={(targetRows as TransferTarget[] | null) ?? []}
      flowTransactions={(flowRows as FlowTx[] | null) ?? []}
      inboundTransfers={(inboundRows as InboundTransfer[] | null) ?? []}
    />
  );
}
