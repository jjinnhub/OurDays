"use client";

import Link from "next/link";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const krw = new Intl.NumberFormat("ko-KR");
const compact = (v: number) =>
  Math.abs(v) >= 100000000
    ? `${(v / 100000000).toFixed(1)}억`
    : Math.abs(v) >= 10000
      ? `${Math.round(v / 10000)}만`
      : krw.format(v);

export type DonutSlice = {
  id: string;
  label: string;
  icon?: string;
  color: string;
  amount: number;
};

type Props = {
  title: string;
  centerLabel: string;
  slices: DonutSlice[];
  emptyMessage: string;
  href: string;
};

export function DonutWidget({ title, centerLabel, slices, emptyMessage, href }: Props) {
  // 상위 5개 + 그 외
  const top = slices.slice(0, 5);
  const rest = slices.slice(5);
  const restSum = rest.reduce((s, c) => s + c.amount, 0);
  const data =
    restSum > 0
      ? [...top, { id: "__rest__", label: "그 외", color: "#B0A89E", amount: restSum }]
      : top;
  const total = slices.reduce((s, c) => s + c.amount, 0);

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex-row items-baseline justify-between space-y-0 px-4 pb-1.5 pt-3.5">
        <CardTitle className="text-base">{title}</CardTitle>
        <Link
          href={href}
          className="text-xs text-muted-foreground underline-offset-4 hover:underline"
        >
          자세히
        </Link>
      </CardHeader>
      <CardContent className="flex flex-1 items-center gap-3 px-4 pb-3.5 pt-0">
        {data.length === 0 ? (
          <p className="w-full py-8 text-center text-sm text-muted-foreground">
            {emptyMessage}
          </p>
        ) : (
          <>
            <div className="relative h-32 w-32 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    dataKey="amount"
                    nameKey="label"
                    innerRadius={38}
                    outerRadius={60}
                    paddingAngle={2}
                    strokeWidth={0}
                  >
                    {data.map((entry) => (
                      <Cell key={entry.id} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(36 100% 99%)",
                      border: "1px solid hsl(30 37% 87%)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(v) => [`${krw.format(Number(v))}원`]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[10px] text-muted-foreground">{centerLabel}</span>
                <span className="text-xs font-bold">{compact(total)}원</span>
              </div>
            </div>
            <ul className="min-w-0 flex-1 space-y-1">
              {data.map((slice) => (
                <li key={slice.id} className="flex items-center gap-1.5 text-xs">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: slice.color }}
                  />
                  <span className="min-w-0 flex-1 truncate">
                    {slice.icon ? `${slice.icon} ` : ""}
                    {slice.label}
                  </span>
                  <span className="shrink-0 text-muted-foreground">
                    {total > 0 ? Math.round((slice.amount / total) * 100) : 0}%
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}
