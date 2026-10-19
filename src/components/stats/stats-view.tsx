"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CHART_COLORS,
  type CategorySlice,
  type GroupSlice,
  type MemberSpend,
  type MonthlyFlow,
  type NetWorthPoint,
} from "@/lib/stats-constants";
import { cn } from "@/lib/utils";

const krw = new Intl.NumberFormat("ko-KR");
const compact = (v: number) =>
  Math.abs(v) >= 100000000
    ? `${(v / 100000000).toFixed(1)}억`
    : Math.abs(v) >= 10000
      ? `${Math.round(v / 10000)}만`
      : krw.format(v);

type LedgerStats = {
  monthlyFlow: MonthlyFlow[];
  categorySlices: CategorySlice[];
  memberSpend: MemberSpend[];
};

type Props = {
  tab: "ledger" | "assets";
  month: string;
  ledgerFamily: LedgerStats;
  ledgerPersonal: LedgerStats;
  groupSlicesFamily: GroupSlice[];
  groupSlicesMine: GroupSlice[];
  netWorthFamily: NetWorthPoint[];
  netWorthMine: NetWorthPoint[];
};

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const tooltipStyle = {
  backgroundColor: "hsl(36 100% 99%)",
  border: "1px solid hsl(30 37% 87%)",
  borderRadius: 8,
  fontSize: 12,
};

export function StatsView({
  tab,
  month,
  ledgerFamily,
  ledgerPersonal,
  groupSlicesFamily,
  groupSlicesMine,
  netWorthFamily,
  netWorthMine,
}: Props) {
  const [assetScope, setAssetScope] = useState<"family" | "mine">("family");
  const [ledgerScope, setLedgerScope] = useState<"family" | "personal">("family");
  const { monthlyFlow, categorySlices, memberSpend } =
    ledgerScope === "family" ? ledgerFamily : ledgerPersonal;
  const groupSlices = assetScope === "family" ? groupSlicesFamily : groupSlicesMine;
  const netWorthTrend = assetScope === "family" ? netWorthFamily : netWorthMine;
  const router = useRouter();
  const pathname = usePathname();
  const [year, monthNum] = month.split("-").map(Number);

  // 카테고리 도넛: 상위 7개 + 기타 묶기
  const donutData = useMemo(() => {
    const top = categorySlices.slice(0, 7);
    const rest = categorySlices.slice(7);
    const restSum = rest.reduce((s, c) => s + c.amount, 0);
    return restSum > 0
      ? [...top, { id: "rest", name: "그 외", icon: "📦", color: "#B0A89E", amount: restSum }]
      : top;
  }, [categorySlices]);
  const expenseTotal = categorySlices.reduce((s, c) => s + c.amount, 0);

  const assetDonut = useMemo(
    () => groupSlices.filter((g) => !g.isLiability),
    [groupSlices],
  );
  const debtGroups = useMemo(
    () => groupSlices.filter((g) => g.isLiability),
    [groupSlices],
  );
  const assetTotal = assetDonut.reduce((s, g) => s + g.amount, 0);

  function go(nextTab: "ledger" | "assets", nextMonth = month) {
    router.push(`${pathname}?tab=${nextTab}&month=${nextMonth}`);
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">통계</h1>
        <div className="grid grid-cols-2 gap-1 rounded-lg border bg-card p-1">
          {(
            [
              { key: "ledger", label: "가계부" },
              { key: "assets", label: "자산" },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => go(t.key)}
              className={cn(
                "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
                tab === t.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      {tab === "ledger" ? (
        <>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { key: "family", label: "가족 가계부" },
                { key: "personal", label: "🔒 개인 가계부" },
              ] as const
            ).map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setLedgerScope(t.key)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium",
                  ledgerScope === t.key
                    ? "border-primary bg-primary/10"
                    : "bg-card text-muted-foreground hover:bg-muted",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* 월 네비게이션 */}
          <div className="flex items-center justify-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              aria-label="이전 달"
              onClick={() => go("ledger", shiftMonth(month, -1))}
            >
              <ChevronLeft />
            </Button>
            <span className="min-w-28 text-center text-base font-semibold">
              {year}년 {monthNum}월
            </span>
            <Button
              variant="ghost"
              size="icon"
              aria-label="다음 달"
              onClick={() => go("ledger", shiftMonth(month, 1))}
            >
              <ChevronRight />
            </Button>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            {/* ---------- 카테고리별 지출 ---------- */}
            <Card>
              <CardHeader className="px-4 pb-1.5 pt-3.5">
                <CardTitle className="text-base">카테고리별 지출</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 pt-0">
                {donutData.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    {ledgerScope === "personal"
                      ? "이번 달 개인 지출이 없어요."
                      : "이번 달 지출이 없어요."}
                  </p>
                ) : (
                  <div className="flex flex-col items-center gap-3 sm:flex-row">
                    <div className="relative h-48 w-48 shrink-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={donutData}
                            dataKey="amount"
                            nameKey="name"
                            innerRadius={58}
                            outerRadius={88}
                            paddingAngle={2}
                            strokeWidth={0}
                          >
                            {donutData.map((entry) => (
                              <Cell key={entry.id} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={tooltipStyle}
                            formatter={(v) => [`${krw.format(Number(v))}원`]}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-xs text-muted-foreground">총 지출</span>
                        <span className="text-sm font-bold">
                          {compact(expenseTotal)}원
                        </span>
                      </div>
                    </div>
                    <ul className="w-full min-w-0 flex-1 space-y-1.5">
                      {donutData.map((slice) => (
                        <li
                          key={slice.id}
                          className="flex items-center gap-2 text-sm"
                        >
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: slice.color }}
                          />
                          <span className="min-w-0 flex-1 truncate">
                            {slice.icon} {slice.name}
                          </span>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {expenseTotal > 0
                              ? Math.round((slice.amount / expenseTotal) * 100)
                              : 0}
                            %
                          </span>
                          <span className="shrink-0 font-semibold">
                            {krw.format(slice.amount)}원
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ---------- 구성원별 지출 (개인 범위에선 숨김) ---------- */}
            {ledgerScope === "family" && (
            <Card>
              <CardHeader className="px-4 pb-1.5 pt-3.5">
                <CardTitle className="text-base">구성원별 지출</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 pt-0">
                {memberSpend.every((m) => m.amount === 0) ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    이번 달 지출이 없어요.
                  </p>
                ) : (
                  <div style={{ height: Math.max(memberSpend.length * 52, 120) }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={memberSpend}
                        layout="vertical"
                        margin={{ left: 8, right: 56, top: 4, bottom: 4 }}
                      >
                        <XAxis type="number" hide />
                        <YAxis
                          type="category"
                          dataKey="name"
                          axisLine={false}
                          tickLine={false}
                          width={64}
                          tick={{ fontSize: 12 }}
                        />
                        <Tooltip
                          contentStyle={tooltipStyle}
                          cursor={{ fill: "rgba(0,0,0,0.04)" }}
                          formatter={(v) => [`${krw.format(Number(v))}원`, "지출"]}
                        />
                        <Bar
                          dataKey="amount"
                          radius={[0, 4, 4, 0]}
                          barSize={18}
                          label={{
                            position: "right",
                            fontSize: 11,
                            formatter: (v: unknown) => `${compact(Number(v))}원`,
                          }}
                        >
                          {memberSpend.map((entry) => (
                            <Cell key={entry.user_id} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
            )}

            {/* ---------- 월별 수입/지출 ---------- */}
            <Card className="lg:col-span-2">
              <CardHeader className="px-4 pb-1.5 pt-3.5">
                <CardTitle className="text-base">월별 수입·지출 (최근 6개월)</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 pt-0">
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyFlow} margin={{ top: 8, right: 8, left: 8 }}>
                      <CartesianGrid vertical={false} stroke="hsl(30 37% 90%)" />
                      <XAxis
                        dataKey="label"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12 }}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        width={48}
                        tick={{ fontSize: 11 }}
                        tickFormatter={(v) => compact(Number(v))}
                      />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        cursor={{ fill: "rgba(0,0,0,0.04)" }}
                        formatter={(v, name) => [
                          `${krw.format(Number(v))}원`,
                          name === "income" ? "수입" : "지출",
                        ]}
                      />
                      <Legend
                        formatter={(value) => (value === "income" ? "수입" : "지출")}
                        wrapperStyle={{ fontSize: 12 }}
                      />
                      <Bar
                        dataKey="income"
                        fill={CHART_COLORS.income}
                        radius={[4, 4, 0, 0]}
                        barSize={16}
                      />
                      <Bar
                        dataKey="expense"
                        fill={CHART_COLORS.expense}
                        radius={[4, 4, 0, 0]}
                        barSize={16}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        <>
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              { key: "family", label: "가족 자산" },
              { key: "mine", label: "🔒 내 자산" },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setAssetScope(t.key)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium",
                assetScope === t.key
                  ? "border-primary bg-primary/10"
                  : "bg-card text-muted-foreground hover:bg-muted",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {/* ---------- 자산 구성 ---------- */}
          <Card>
            <CardHeader className="px-4 pb-1.5 pt-3.5">
              <CardTitle className="text-base">자산 구성</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0">
              {assetDonut.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  {assetScope === "mine" ? "나만 보는 자산이 없어요." : "등록된 자산이 없어요."}{" "}
                  <Link href="/accounts" className="text-primary underline">
                    자산 추가하기
                  </Link>
                </p>
              ) : (
                <div className="flex flex-col items-center gap-3 sm:flex-row">
                  <div className="relative h-48 w-48 shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={assetDonut}
                          dataKey="amount"
                          nameKey="label"
                          innerRadius={58}
                          outerRadius={88}
                          paddingAngle={2}
                          strokeWidth={0}
                        >
                          {assetDonut.map((entry) => (
                            <Cell key={entry.key} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={tooltipStyle}
                          formatter={(v) => [`${krw.format(Number(v))}원`]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-xs text-muted-foreground">총 자산</span>
                      <span className="text-sm font-bold">{compact(assetTotal)}원</span>
                    </div>
                  </div>
                  <ul className="w-full min-w-0 flex-1 space-y-1.5">
                    {assetDonut.map((g) => (
                      <li key={g.key} className="flex items-center gap-2 text-sm">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: g.color }}
                        />
                        <span className="min-w-0 flex-1 truncate">{g.label}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {assetTotal > 0 ? Math.round((g.amount / assetTotal) * 100) : 0}%
                        </span>
                        <span className="shrink-0 font-semibold">
                          {krw.format(g.amount)}원
                        </span>
                      </li>
                    ))}
                    {debtGroups.map((g) => (
                      <li key={g.key} className="flex items-center gap-2 text-sm opacity-80">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: g.color }}
                        />
                        <span className="min-w-0 flex-1 truncate">{g.label} (부채)</span>
                        <span className="shrink-0 font-semibold text-destructive">
                          -{krw.format(g.amount)}원
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ---------- 순자산 추이 ---------- */}
          <Card>
            <CardHeader className="px-4 pb-1.5 pt-3.5">
              <CardTitle className="text-base">순자산 추이</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0">
              {netWorthTrend.length < 2 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  아직 추이를 그릴 데이터가 부족해요. 자산 금액이 바뀔 때마다 이력이
                  쌓여서 다음 달부터 그래프가 생겨요.
                </p>
              ) : (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={netWorthTrend}
                      margin={{ top: 8, right: 8, left: 8 }}
                    >
                      <CartesianGrid vertical={false} stroke="hsl(30 37% 90%)" />
                      <XAxis
                        dataKey="label"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12 }}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        width={52}
                        tick={{ fontSize: 11 }}
                        tickFormatter={(v) => compact(Number(v))}
                      />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(v, name) => [
                          `${krw.format(Number(v))}원`,
                          name === "asset" ? "자산" : name === "debt" ? "부채" : "순자산",
                        ]}
                      />
                      <Legend
                        formatter={(value) =>
                          value === "asset" ? "자산" : value === "debt" ? "부채" : "순자산"
                        }
                        wrapperStyle={{ fontSize: 12 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="asset"
                        stroke={CHART_COLORS.asset}
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="debt"
                        stroke={CHART_COLORS.debt}
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="net"
                        stroke={CHART_COLORS.net}
                        strokeWidth={2.5}
                        dot={{ r: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        </>
      )}
    </div>
  );
}
