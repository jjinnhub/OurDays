import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { StatsView } from "@/components/stats/stats-view";
import { ASSET_GROUP_MAP, ASSET_GROUPS } from "@/lib/asset-constants";
import { getUserAndMembership } from "@/lib/family";
import type {
  CategorySlice,
  GroupSlice,
  MemberSpend,
  MonthlyFlow,
  NetWorthPoint,
} from "@/lib/stats-constants";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "통계" };

function ym(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; month?: string }>;
}) {
  const { user, membership } = await getUserAndMembership();
  if (!user || !membership) redirect("/login");

  const params = await searchParams;
  const tab = params.tab === "assets" ? "assets" : "ledger";
  const month = /^\d{4}-\d{2}$/.test(params.month ?? "") ? params.month! : ym(new Date());

  const [y, m] = month.split("-").map(Number);
  const sixMonthsAgo = new Date(y, m - 1 - 5, 1);
  const rangeStart = `${ym(sixMonthsAgo)}-01`;
  const nextMonth = new Date(y, m, 1);
  const rangeEnd = `${ym(nextMonth)}-01`;

  const supabase = await createClient();
  const [
    { data: txRows },
    { data: categoryRows },
    { data: memberRows },
    { data: assetRows },
    { data: historyRows },
  ] = await Promise.all([
    supabase
      .from("transactions")
      .select("type, amount, occurred_on, category_id, member_user_id, is_private")
      .eq("family_id", membership.family_id)
      .is("deleted_at", null)
      .gte("occurred_on", rangeStart)
      .lt("occurred_on", rangeEnd),
    supabase
      .from("categories")
      .select("id, name, icon, color")
      .eq("family_id", membership.family_id),
    supabase
      .from("family_members")
      .select("user_id, display_name, color")
      .eq("family_id", membership.family_id),
    supabase
      .from("assets")
      .select("id, group_key, amount, is_private")
      .eq("family_id", membership.family_id)
      .eq("is_archived", false),
    supabase
      .from("asset_balance_history")
      .select("asset_id, amount, recorded_at")
      .order("recorded_at", { ascending: true }),
  ]);

  type TxRow = {
    type: string;
    amount: number | string;
    occurred_on: string;
    category_id: string | null;
    member_user_id: string | null;
    is_private: boolean;
  };
  const txs = (txRows as TxRow[] | null) ?? [];
  const categories =
    (categoryRows as { id: string; name: string; icon: string; color: string }[] | null) ??
    [];
  const members =
    (memberRows as { user_id: string; display_name: string; color: string }[] | null) ??
    [];
  const allAssets =
    (assetRows as
      | { id: string; group_key: string; amount: number | string; is_private: boolean }[]
      | null) ?? [];
  const history =
    (historyRows as
      | { asset_id: string; amount: number | string; recorded_at: string }[]
      | null) ?? [];

  // ---------- 가계부 집계 (가족/개인 범위별) ----------
  const categoryById = new Map(categories.map((c) => [c.id, c]));

  function buildLedgerStats(list: TxRow[]) {
    const monthlyFlow: MonthlyFlow[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(y, m - 1 - i, 1);
      monthlyFlow.push({
        month: ym(d),
        label: `${d.getMonth() + 1}월`,
        income: 0,
        expense: 0,
      });
    }
    const flowByMonth = new Map(monthlyFlow.map((f) => [f.month, f]));
    const catTotals = new Map<string, number>();
    const memberTotals = new Map<string, number>();

    for (const tx of list) {
      const amt = Number(tx.amount);
      const bucket = flowByMonth.get(tx.occurred_on.slice(0, 7));
      if (bucket) {
        if (tx.type === "income") bucket.income += amt;
        if (tx.type === "expense") bucket.expense += amt;
      }
      if (tx.type === "expense" && tx.occurred_on.slice(0, 7) === month) {
        const key = tx.category_id ?? "none";
        catTotals.set(key, (catTotals.get(key) ?? 0) + amt);
        if (tx.member_user_id) {
          memberTotals.set(
            tx.member_user_id,
            (memberTotals.get(tx.member_user_id) ?? 0) + amt,
          );
        }
      }
    }

    const categorySlices: CategorySlice[] = [...catTotals.entries()]
      .map(([id, amount]) => {
        const c = id === "none" ? null : categoryById.get(id);
        return {
          id,
          name: c?.name ?? "미분류",
          icon: c?.icon ?? "📌",
          color: c?.color ?? "#878787",
          amount,
        };
      })
      .sort((a, b) => b.amount - a.amount);

    const memberSpend: MemberSpend[] = members
      .map((mem) => ({
        user_id: mem.user_id,
        name: mem.display_name,
        color: mem.color,
        amount: memberTotals.get(mem.user_id) ?? 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    return { monthlyFlow, categorySlices, memberSpend };
  }

  const ledgerFamily = buildLedgerStats(txs.filter((t) => !t.is_private));
  const ledgerPersonal = buildLedgerStats(txs.filter((t) => t.is_private));

  // ---------- 자산 구성 / 순자산 추이: 가족 공동과 내 자산을 분리 집계 ----------
  function buildGroupSlices(list: typeof allAssets): GroupSlice[] {
    const groupTotals = new Map<string, number>();
    for (const asset of list) {
      groupTotals.set(
        asset.group_key,
        (groupTotals.get(asset.group_key) ?? 0) + Number(asset.amount),
      );
    }
    return ASSET_GROUPS.filter((g) => groupTotals.has(g.key)).map((g) => ({
      key: g.key,
      label: g.label,
      color: g.color,
      amount: groupTotals.get(g.key) ?? 0,
      isLiability: g.isLiability,
    }));
  }

  function buildNetWorthTrend(list: typeof allAssets): NetWorthPoint[] {
    const liabilityByAsset = new Map(
      list.map((a) => [
        a.id,
        ASSET_GROUP_MAP[a.group_key as keyof typeof ASSET_GROUP_MAP]?.isLiability ?? false,
      ]),
    );
    const trend: NetWorthPoint[] = [];
    if (history.length === 0) return trend;

    const firstMonth = history[0].recorded_at.slice(0, 7);
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStr = ym(d);
      if (monthStr < firstMonth) continue;
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString();

      const latest = new Map<string, number>();
      for (const h of history) {
        if (h.recorded_at >= end) break;
        latest.set(h.asset_id, Number(h.amount));
      }
      let assetSum = 0;
      let debtSum = 0;
      for (const [assetId, amount] of latest) {
        if (!liabilityByAsset.has(assetId)) continue; // 범위 밖/삭제 자산 제외
        if (liabilityByAsset.get(assetId)) debtSum += amount;
        else assetSum += amount;
      }
      trend.push({
        label: `${d.getMonth() + 1}월`,
        asset: assetSum,
        debt: debtSum,
        net: assetSum - debtSum,
      });
    }
    return trend;
  }

  const familyAssets = allAssets.filter((a) => !a.is_private);
  const myAssets = allAssets.filter((a) => a.is_private);

  const groupSlicesFamily = buildGroupSlices(familyAssets);
  const groupSlicesMine = buildGroupSlices(myAssets);
  const netWorthFamily = buildNetWorthTrend(familyAssets);
  const netWorthMine = buildNetWorthTrend(myAssets);

  return (
    <StatsView
      tab={tab}
      month={month}
      ledgerFamily={ledgerFamily}
      ledgerPersonal={ledgerPersonal}
      groupSlicesFamily={groupSlicesFamily}
      groupSlicesMine={groupSlicesMine}
      netWorthFamily={netWorthFamily}
      netWorthMine={netWorthMine}
    />
  );
}
