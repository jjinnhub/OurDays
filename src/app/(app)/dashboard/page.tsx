import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CalendarDays,
  ReceiptText,
  Wallet,
} from "lucide-react";

import { DonutWidget, type DonutSlice } from "@/components/dashboard/donut-widget";
import { InviteBanner } from "@/components/dashboard/invite-banner";
import { InviteCodeBox } from "@/components/dashboard/family-widget";
import { Widget, WidgetEmpty } from "@/components/dashboard/widget";
import { Card, CardContent } from "@/components/ui/card";
import {
  expandEvents,
  parseDate,
  type DayChip,
  type EventRow,
} from "@/lib/calendar-constants";
import { ASSET_GROUPS } from "@/lib/asset-constants";
import { getUserAndMembership } from "@/lib/family";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "홈",
};

type MemberRow = {
  user_id: string;
  role: string;
  display_name: string;
  color: string;
};

const krw = new Intl.NumberFormat("ko-KR");

export default async function DashboardPage() {
  const { user, membership } = await getUserAndMembership();
  if (!user || !membership) redirect("/login");

  const supabase = await createClient();
  const { data } = await supabase
    .from("family_members")
    .select("user_id, role, display_name, color")
    .eq("family_id", membership.family_id)
    .order("created_at", { ascending: true });
  const members = (data as MemberRow[] | null) ?? [];

  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthStart = `${ym}-01`;
  const nextMonthStart = `${now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear()}-${String(now.getMonth() === 11 ? 1 : now.getMonth() + 2).padStart(2, "0")}-01`;

  await supabase.rpc("ensure_fixed_cost_occurrences", {
    p_family_id: membership.family_id,
  });
  const weekLater = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  const [
    { data: monthTxRows },
    { data: recentTxRows },
    { data: categoryRows },
    { data: fcOccRows },
    { data: eventRows },
    { data: assetRows },
  ] = await Promise.all([
      supabase
        .from("transactions")
        .select("type, amount, category_id")
        .eq("family_id", membership.family_id)
        .eq("is_private", false)
        .is("deleted_at", null)
        .gte("occurred_on", monthStart)
        .lt("occurred_on", nextMonthStart),
      supabase
        .from("transactions")
        .select("id, type, title, amount, occurred_on, category_id, member_user_id")
        .eq("family_id", membership.family_id)
        .eq("is_private", false)
        .is("deleted_at", null)
        .lte("occurred_on", new Date().toISOString().slice(0, 10))
        .order("occurred_on", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("categories")
        .select("id, name, icon, color")
        .eq("family_id", membership.family_id),
      supabase
        .from("fixed_cost_occurrences")
        .select("id, due_on, amount, status, fixed_costs!inner(name, is_private)")
        .eq("family_id", membership.family_id)
        .eq("fixed_costs.is_private", false)
        .eq("status", "pending")
        .lte("due_on", weekLater)
        .order("due_on", { ascending: true })
        .limit(6),
      supabase
        .from("events")
        .select("*, event_attendees(user_id)")
        .eq("family_id", membership.family_id),
      supabase
        .from("assets")
        .select("group_key, amount")
        .eq("family_id", membership.family_id)
        .eq("is_archived", false)
        .eq("is_private", false),
    ]);

  type FcOccRow = {
    id: string;
    due_on: string;
    amount: number | string;
    fixed_costs: { name: string } | null;
  };
  const upcomingFc = (fcOccRows as FcOccRow[] | null) ?? [];
  const todayStr = new Date().toISOString().slice(0, 10);

  // 오늘부터 7일간의 일정 (반복 전개 + 생일)
  const weekEvents: DayChip[] = [];
  {
    const chipMap = expandEvents(
      (eventRows as EventRow[] | null) ?? [],
      todayStr,
      weekLater,
    );
    for (const d of [...chipMap.keys()].sort()) {
      weekEvents.push(...(chipMap.get(d) ?? []));
    }
  }

  let monthIncome = 0;
  let monthExpense = 0;
  const catTotals = new Map<string, number>();
  for (const tx of (monthTxRows as
    | { type: string; amount: number | string; category_id: string | null }[]
    | null) ?? []) {
    const amt = Number(tx.amount);
    if (tx.type === "income") monthIncome += amt;
    if (tx.type === "expense") {
      monthExpense += amt;
      const key = tx.category_id ?? "none";
      catTotals.set(key, (catTotals.get(key) ?? 0) + amt);
    }
  }

  type RecentTx = {
    id: string;
    type: string;
    title: string;
    amount: number | string;
    occurred_on: string;
    category_id: string | null;
    member_user_id: string | null;
  };
  const recentTx = (recentTxRows as RecentTx[] | null) ?? [];
  const categoryById = new Map(
    (
      (categoryRows as { id: string; name: string; icon: string; color: string }[] | null) ??
      []
    ).map((c) => [c.id, c]),
  );

  const categorySlices: DonutSlice[] = [...catTotals.entries()]
    .map(([id, amount]) => {
      const c = id === "none" ? null : categoryById.get(id);
      return {
        id,
        label: c?.name ?? "미분류",
        icon: c?.icon ?? "📌",
        color: c?.color ?? "#878787",
        amount,
      };
    })
    .sort((a, b) => b.amount - a.amount);

  const assetGroupTotals = new Map<string, number>();
  for (const asset of (assetRows as
    | { group_key: string; amount: number | string }[]
    | null) ?? []) {
    assetGroupTotals.set(
      asset.group_key,
      (assetGroupTotals.get(asset.group_key) ?? 0) + Number(asset.amount),
    );
  }
  const assetSlices: DonutSlice[] = ASSET_GROUPS.filter(
    (g) => !g.isLiability && assetGroupTotals.has(g.key),
  )
    .map((g) => ({
      id: g.key,
      label: g.label,
      color: g.color,
      amount: assetGroupTotals.get(g.key) ?? 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  const { data: profileRows } = await supabase
    .from("profiles")
    .select("id, name, birthdate")
    .in("id", members.map((m) => m.user_id));
  const nameById = new Map(
    ((profileRows as { id: string; name: string }[] | null) ?? []).map((p) => [
      p.id,
      p.name,
    ]),
  );
  const myName = nameById.get(user.id) || membership.display_name;

  // 가족 생일을 주간 일정에 추가
  {
    const start = parseDate(todayStr);
    for (let i = 0; i <= 7; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      for (const m of members) {
        const profile = (profileRows as { id: string; name: string; birthdate?: string | null }[] | null)?.find(
          (p) => p.id === m.user_id,
        );
        if (!profile?.birthdate) continue;
        if (profile.birthdate.slice(5) === dateStr.slice(5)) {
          weekEvents.push({
            date: dateStr,
            kind: "birthday",
            label: `🎂 ${profile.name || m.display_name} 생일`,
            color: m.color,
            sortKey: "0",
          });
        }
      }
    }
    weekEvents.sort((a, b) => (a.date + a.sortKey).localeCompare(b.date + b.sortKey));
  }

  const today = new Date();
  const monthLabel = `${today.getMonth() + 1}월`;
  const canRegenerate = membership.role === "owner" || membership.role === "admin";

  return (
    <div className="space-y-3">
      <header>
        <h1 className="text-xl font-bold">{myName} 님, 어서 오세요 😊</h1>
        <p className="text-sm text-muted-foreground">
          {today.toLocaleDateString("ko-KR", {
            month: "long",
            day: "numeric",
            weekday: "long",
          })}{" "}
          · {membership.families.name}
        </p>
      </header>

      {members.length === 1 && (
        <InviteBanner inviteCode={membership.families.invite_code} />
      )}

      <div className="grid gap-3 lg:grid-cols-3">
        {/* ---------- 좌측: 요약 + 통계 + 위젯 ---------- */}
        <div className="space-y-3 lg:col-span-2">
          {/* ---------- 이번 달 가계 요약 ---------- */}
          <Card>
            <CardContent className="p-4 md:p-5">
              <div className="flex items-baseline justify-between">
                <h2 className="font-semibold">{monthLabel} 가계 요약</h2>
                <Link
                  href="/ledger"
                  className="text-xs text-muted-foreground underline-offset-4 hover:underline"
                >
                  가계부 열기
                </Link>
              </div>
              <dl className="mt-2.5 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-muted/50 py-2.5">
                  <dt className="text-xs text-muted-foreground">수입</dt>
                  <dd className="text-base font-bold text-blue-600 md:text-xl dark:text-blue-400">
                    {krw.format(monthIncome)}원
                  </dd>
                </div>
                <div className="rounded-lg bg-muted/50 py-2.5">
                  <dt className="text-xs text-muted-foreground">지출</dt>
                  <dd className="text-base font-bold text-primary md:text-xl">
                    {krw.format(monthExpense)}원
                  </dd>
                </div>
                <div className="rounded-lg bg-muted/50 py-2.5">
                  <dt className="text-xs text-muted-foreground">남은 금액</dt>
                  <dd className="text-base font-bold md:text-xl">
                    {krw.format(monthIncome - monthExpense)}원
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <div className="grid gap-3 sm:grid-cols-2">
          {/* ---------- 카테고리별 지출 / 자산 구성 ---------- */}
          <DonutWidget
            title={`${monthLabel} 카테고리별 지출`}
            centerLabel="총 지출"
            slices={categorySlices}
            emptyMessage="이번 달 지출이 없어요."
            href={`/stats?tab=ledger&month=${ym}`}
          />
          <DonutWidget
            title="자산 구성"
            centerLabel="총 자산"
            slices={assetSlices}
            emptyMessage="등록된 자산이 없어요."
            href="/stats?tab=assets"
          />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {/* ---------- 다가오는 고정비 ---------- */}
          <Widget title="다가오는 고정비" action={{ label: "월 예산 열기", href: "/fixed-costs" }}>
            {upcomingFc.length === 0 ? (
              <WidgetEmpty
                icon={<ReceiptText className="h-7 w-7" />}
                message="7일 안에 낼 고정비가 없어요."
              />
            ) : (
              <ul className="space-y-2">
                {upcomingFc.map((occ) => {
                  const d = new Date(occ.due_on);
                  const overdue = occ.due_on < todayStr;
                  const dday = Math.round(
                    (d.getTime() - new Date(todayStr).getTime()) / 86400000,
                  );
                  return (
                    <li key={occ.id} className="flex items-center gap-2.5 text-sm">
                      <span
                        className={cn(
                          "w-14 shrink-0 rounded-full px-1.5 py-0.5 text-center text-[11px] font-semibold",
                          overdue
                            ? "bg-destructive/15 text-destructive"
                            : dday === 0
                              ? "bg-accent/40 text-accent-foreground"
                              : "bg-muted text-muted-foreground",
                        )}
                      >
                        {overdue ? `D+${-dday}` : dday === 0 ? "오늘" : `D-${dday}`}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">
                          {occ.fixed_costs?.name ?? "고정비"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {d.getMonth() + 1}월 {d.getDate()}일
                        </span>
                      </span>
                      <span className="shrink-0 text-sm font-bold">
                        {krw.format(Number(occ.amount))}원
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Widget>
  
          {/* ---------- 이번 주 일정 ---------- */}
          <Widget title="이번 주 일정" action={{ label: "캘린더 열기", href: "/calendar" }}>
            {weekEvents.length === 0 ? (
              <WidgetEmpty
                icon={<CalendarDays className="h-7 w-7" />}
                message="7일 안에 잡힌 일정이 없어요. 가족 일정을 등록해 보세요."
              />
            ) : (
              <ul className="space-y-2">
                {weekEvents.slice(0, 6).map((chip, i) => {
                  const d = parseDate(chip.date);
                  const weekday = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
                  return (
                    <li key={i} className="flex items-center gap-2.5 text-sm">
                      <span className="w-14 shrink-0 text-xs text-muted-foreground">
                        {d.getMonth() + 1}/{d.getDate()} ({weekday})
                      </span>
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: chip.color }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{chip.label}</span>
                        <span className="text-xs text-muted-foreground">
                          {chip.kind === "birthday"
                            ? "생일"
                            : chip.event?.all_day
                              ? "종일"
                              : (chip.time ?? "")}
                          {chip.event?.location && ` · ${chip.event.location}`}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Widget>
  
          {/* ---------- 최근 거래 ---------- */}
          <Widget title="최근 거래" action={{ label: "가계부 열기", href: "/ledger" }}>
            {recentTx.length === 0 ? (
              <WidgetEmpty
                icon={<Wallet className="h-7 w-7" />}
                message="아직 기록된 거래가 없어요. 첫 지출을 입력해 보세요."
              />
            ) : (
              <ul className="space-y-2">
                {recentTx.map((tx) => {
                  const category = tx.category_id
                    ? categoryById.get(tx.category_id)
                    : null;
                  const member = tx.member_user_id
                    ? members.find((m) => m.user_id === tx.member_user_id)
                    : null;
                  const d = new Date(tx.occurred_on);
                  return (
                    <li key={tx.id} className="flex items-center gap-2.5 text-sm">
                      <span
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm"
                        style={{ backgroundColor: `${category?.color ?? "#878787"}22` }}
                      >
                        {tx.type === "transfer" ? "🔁" : (category?.icon ?? "📌")}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">
                          {tx.title ||
                            (tx.type === "transfer" ? "이체" : (category?.name ?? "미분류"))}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          {d.getMonth() + 1}월 {d.getDate()}일
                          {member && (
                            <>
                              {" · "}
                              <span
                                className="inline-block h-2 w-2 rounded-full"
                                style={{ backgroundColor: member.color }}
                              />
                              {member.display_name}
                            </>
                          )}
                        </span>
                      </span>
                      <span
                        className={cn(
                          "shrink-0 text-sm font-bold",
                          tx.type === "income" && "text-blue-600 dark:text-blue-400",
                          tx.type === "transfer" && "text-muted-foreground",
                        )}
                      >
                        {tx.type === "income" ? "+" : tx.type === "expense" ? "-" : ""}
                        {krw.format(Number(tx.amount))}원
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Widget>
          </div>
        </div>

        {/* ---------- 우측: 우리 가족 (모바일에선 맨 위) ---------- */}
        <div className="order-first space-y-3 lg:order-none">
          {/* ---------- 우리 가족 ---------- */}
          <Widget title="우리 가족">
            <ul className="space-y-1.5">
              {members.map((m) => (
                <li key={m.user_id} className="flex items-center gap-2.5 text-sm">
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: m.color }}
                  />
                  <span className="font-medium">
                    {nameById.get(m.user_id) || m.display_name}
                  </span>
                  <span className="text-xs text-muted-foreground">{m.display_name}</span>
                  {m.role === "owner" && (
                    <span className="rounded-full bg-accent/30 px-2 py-0.5 text-[11px] text-accent-foreground">
                      대표
                    </span>
                  )}
                  {m.user_id === user.id && (
                    <span className="text-xs text-muted-foreground">(나)</span>
                  )}
                </li>
              ))}
            </ul>
            <div className="mt-2">
              <InviteCodeBox
                familyId={membership.family_id}
                inviteCode={membership.families.invite_code}
                inviteExpiresAt={membership.families.invite_expires_at}
                canRegenerate={canRegenerate}
              />
            </div>
          </Widget>
        </div>
      </div>
    </div>
  );
}
