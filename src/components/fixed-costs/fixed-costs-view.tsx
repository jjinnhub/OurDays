"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Check,
  CircleSlash,
  Loader2,
  Pencil,
  Plus,
  ReceiptText,
  RotateCcw,
} from "lucide-react";

import { FixedCostFormModal } from "@/components/fixed-costs/fixed-cost-form-modal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { ASSET_GROUP_MAP, type AssetGroupKey } from "@/lib/asset-constants";
import type { FamilyMemberLite } from "@/lib/asset-constants";
import {
  FC_PURPOSE_MAP,
  type FcOccurrence,
  type FixedCost,
} from "@/lib/fixed-cost-constants";
import type { AssetLite } from "@/lib/ledger-constants";
import { formatAmountInput } from "@/lib/ledger-constants";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const krw = new Intl.NumberFormat("ko-KR");

type Props = {
  familyId: string;
  fixedCosts: FixedCost[];
  occurrences: FcOccurrence[]; // 이번 달 + 밀린 미납
  members: FamilyMemberLite[];
  assets: AssetLite[];
  canEdit: boolean;
  currentUserId: string;
  /** 가족 월 예산 (budget_settings) */
  expectedIncome: number;
  /** 내 월 예산 (personal_budget_settings) */
  expectedIncomePersonal: number;
};

export function FixedCostsView({
  familyId,
  fixedCosts,
  occurrences,
  members,
  assets,
  canEdit,
  currentUserId,
  expectedIncome,
  expectedIncomePersonal,
}: Props) {
  const [tab, setTab] = useState<"family" | "personal">("family");
  const canWrite = tab === "personal" ? true : canEdit;
  const budgetValue = tab === "family" ? expectedIncome : expectedIncomePersonal;
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<FixedCost | null>(null);
  const [payTarget, setPayTarget] = useState<FcOccurrence | null>(null);
  const [payDate, setPayDate] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fcById = useMemo(() => new Map(fixedCosts.map((f) => [f.id, f])), [fixedCosts]);
  const tabFixedCosts = useMemo(
    () => fixedCosts.filter((f) => (tab === "family" ? !f.is_private : f.is_private)),
    [fixedCosts, tab],
  );
  const tabOccurrences = useMemo(
    () =>
      occurrences.filter((o) => {
        const fc = fcById.get(o.fixed_cost_id);
        return fc ? (tab === "family" ? !fc.is_private : fc.is_private) : false;
      }),
    [occurrences, fcById, tab],
  );
  const assetById = useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets]);
  const memberById = useMemo(
    () => new Map(members.map((m) => [m.user_id, m])),
    [members],
  );

  const today = new Date().toISOString().slice(0, 10);
  const ym = today.slice(0, 7);

  const { overdue, thisMonth, summary, purposeTotals, assetTotals, sections, noOccurrence } =
    useMemo(() => {
      const overdue: FcOccurrence[] = [];
      const thisMonth: FcOccurrence[] = [];
      for (const occ of tabOccurrences) {
        if (occ.due_on.slice(0, 7) === ym) thisMonth.push(occ);
        else if (occ.status === "pending") overdue.push(occ);
      }

      let total = 0;
      let paid = 0;
      let pending = 0;
      const purposeTotals = new Map<string, number>();
      const assetTotals = new Map<string, number>(); // asset_id ("" = 미지정)
      for (const occ of thisMonth) {
        const amt = Number(occ.amount);
        if (occ.status === "skipped") continue;
        total += amt;
        if (occ.status === "paid") paid += amt;
        else pending += amt;
        const fc = fcById.get(occ.fixed_cost_id);
        if (fc) {
          purposeTotals.set(fc.purpose, (purposeTotals.get(fc.purpose) ?? 0) + amt);
          const assetKey = fc.asset_id ?? "";
          assetTotals.set(assetKey, (assetTotals.get(assetKey) ?? 0) + amt);
        }
      }

      // 구성원별 섹션 (공동은 마지막)
      const sections: { key: string; label: string; color?: string; items: FcOccurrence[]; subtotal: number }[] = [];
      const byKey = new Map<string, FcOccurrence[]>();
      for (const occ of thisMonth) {
        const fc = fcById.get(occ.fixed_cost_id);
        const key = fc?.member_user_id ?? "__shared__";
        const list = byKey.get(key) ?? [];
        list.push(occ);
        byKey.set(key, list);
      }
      for (const m of members) {
        const items = byKey.get(m.user_id);
        if (items) {
          sections.push({
            key: m.user_id,
            label: m.display_name,
            color: m.color,
            items: items.sort((a, b) => a.due_on.localeCompare(b.due_on)),
            subtotal: items.reduce(
              (sum, o) => (o.status === "skipped" ? sum : sum + Number(o.amount)),
              0,
            ),
          });
        }
      }
      const shared = byKey.get("__shared__");
      if (shared) {
        sections.push({
          key: "__shared__",
          label: "공동",
          items: shared.sort((a, b) => a.due_on.localeCompare(b.due_on)),
          subtotal: shared.reduce(
            (sum, o) => (o.status === "skipped" ? sum : sum + Number(o.amount)),
            0,
          ),
        });
      }

      // 이번 달 발생이 없는 고정비 (비활성 포함)
      const hasOcc = new Set(thisMonth.map((o) => o.fixed_cost_id));
      const noOccurrence = tabFixedCosts.filter((f) => !hasOcc.has(f.id));

      return {
        overdue: overdue.sort((a, b) => a.due_on.localeCompare(b.due_on)),
        thisMonth,
        summary: { total, paid, pending },
        purposeTotals,
        assetTotals,
        sections,
        noOccurrence,
      };
    }, [tabOccurrences, tabFixedCosts, members, fcById, ym]);

  // 예상 수입 인라인 수정
  const [editingIncome, setEditingIncome] = useState(false);
  const [incomeText, setIncomeText] = useState("");
  const [savingIncome, setSavingIncome] = useState(false);

  async function saveIncome() {
    const amount = Number(incomeText.replace(/[^0-9]/g, ""));
    setSavingIncome(true);
    const supabase = createClient();
    const { error: dbError } =
      tab === "family"
        ? await supabase
            .from("budget_settings")
            .upsert({ family_id: familyId, expected_income: amount })
        : await supabase.from("personal_budget_settings").upsert({
            family_id: familyId,
            user_id: currentUserId,
            expected_income: amount,
          });
    setSavingIncome(false);
    if (dbError) {
      setError(dbError.message);
      return;
    }
    setEditingIncome(false);
    router.refresh();
  }

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(fc: FixedCost) {
    if (!canWrite) return;
    setEditing(fc);
    setFormOpen(true);
  }

  function openPay(occ: FcOccurrence) {
    if (!canWrite) return;
    setPayDate(occ.due_on);
    setPayTarget(occ);
    setError(null);
  }

  async function confirmPay() {
    if (!payTarget) return;
    setBusyId(payTarget.id);
    setError(null);
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("pay_fixed_cost_occurrence", {
      p_occurrence_id: payTarget.id,
      p_paid_on: payDate || null,
    });
    setBusyId(null);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    setPayTarget(null);
    router.refresh();
  }

  async function unpay(occ: FcOccurrence) {
    if (!canWrite || busyId) return;
    setBusyId(occ.id);
    const supabase = createClient();
    await supabase.rpc("unpay_fixed_cost_occurrence", { p_occurrence_id: occ.id });
    setBusyId(null);
    router.refresh();
  }

  async function toggleSkip(occ: FcOccurrence) {
    if (!canWrite || busyId) return;
    setBusyId(occ.id);
    const supabase = createClient();
    await supabase.rpc("skip_fixed_cost_occurrence", {
      p_occurrence_id: occ.id,
      p_skip: occ.status !== "skipped",
    });
    setBusyId(null);
    router.refresh();
  }

  function OccurrenceRow({ occ, showOverdue }: { occ: FcOccurrence; showOverdue?: boolean }) {
    const fc = fcById.get(occ.fixed_cost_id);
    if (!fc) return null;
    const purpose = FC_PURPOSE_MAP[fc.purpose];
    const asset = fc.asset_id ? assetById.get(fc.asset_id) : null;
    const toAsset = fc.to_asset_id ? assetById.get(fc.to_asset_id) : null;
    const member = fc.member_user_id ? memberById.get(fc.member_user_id) : null;
    const day = Number(occ.due_on.slice(8, 10));
    const overdueDays = Math.floor(
      (new Date(today).getTime() - new Date(occ.due_on).getTime()) / 86400000,
    );
    const busy = busyId === occ.id;
    const skipped = occ.status === "skipped";

    return (
      <li
        className={cn(
          "flex items-center gap-2.5 px-3 py-2.5",
          skipped && "opacity-50",
        )}
      >
        {/* 납부 체크 */}
        <button
          type="button"
          disabled={!canWrite || busy || skipped}
          aria-label={occ.status === "paid" ? "납부 취소" : "납부 완료"}
          onClick={() => (occ.status === "paid" ? unpay(occ) : openPay(occ))}
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
            occ.status === "paid"
              ? "border-secondary bg-secondary text-secondary-foreground"
              : "border-muted-foreground/40 text-transparent hover:border-primary",
          )}
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          ) : (
            <Check className="h-4 w-4" />
          )}
        </button>

        <span className="w-9 shrink-0 text-center text-xs font-semibold text-muted-foreground">
          {day}일
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className={cn("truncate text-sm font-medium", occ.status === "paid" && "line-through decoration-muted-foreground/60")}>
              {fc.name}
            </span>
            <span
              className={cn(
                "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                purpose.badge,
              )}
            >
              {purpose.label}
            </span>
            {showOverdue && overdueDays > 0 && occ.status === "pending" && (
              <span className="shrink-0 rounded-full bg-destructive/15 px-1.5 py-0.5 text-[10px] font-semibold text-destructive">
                미납 D+{overdueDays}
              </span>
            )}
            {skipped && (
              <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                건너뜀
              </span>
            )}
          </span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            {member && (
              <>
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: member.color }}
                />
                {member.display_name}
                {(asset || toAsset) && " · "}
              </>
            )}
            {asset && <span className="truncate">{asset.name}</span>}
            {toAsset && (
              <span className="flex items-center gap-0.5 truncate">
                <ArrowRight className="h-3 w-3" />
                {toAsset.name}
              </span>
            )}
          </span>
        </span>

        <span className="shrink-0 text-sm font-bold">
          {krw.format(Number(occ.amount))}원
        </span>

        {canWrite && (
          <span className="flex shrink-0 items-center">
            {occ.status !== "paid" && (
              <button
                type="button"
                aria-label={skipped ? "건너뛰기 취소" : "이번 달 건너뛰기"}
                onClick={() => toggleSkip(occ)}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                {skipped ? (
                  <RotateCcw className="h-4 w-4" />
                ) : (
                  <CircleSlash className="h-4 w-4" />
                )}
              </button>
            )}
            <button
              type="button"
              aria-label="고정비 수정"
              onClick={() => openEdit(fc)}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Pencil className="h-4 w-4" />
            </button>
          </span>
        )}
      </li>
    );
  }

  const monthLabel = Number(ym.slice(5, 7));

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold">월 예산</h1>
        {canWrite && (
          <Button size="sm" onClick={openCreate}>
            <Plus />
            {tab === "personal" ? "내 항목 추가" : "고정비 추가"}
          </Button>
        )}
      </header>

      {/* ---------- 가족/내 예산 탭 (모바일: 요약 카드와 같은 전체 폭) ---------- */}
      <div className="grid w-full grid-cols-2 gap-1 rounded-lg border bg-card p-1 md:w-fit">
        {(
          [
            { key: "family", label: "가족 예산" },
            { key: "personal", label: "🔒 내 예산" },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
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

      {/* ---------- 이번 달 예산 요약 ---------- */}
      <Card>
        <CardContent className="space-y-2.5 p-4 md:p-5">
          <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1.5">
            {/* 예상 수입 (클릭 수정) */}
            <span className="flex w-full items-baseline gap-2 md:w-auto">
              <span className="w-24 shrink-0 text-sm text-muted-foreground md:w-auto">
                {monthLabel}월 예산
              </span>
              {editingIncome ? (
                <span className="flex items-center gap-1.5">
                  <Input
                    inputMode="numeric"
                    autoFocus
                    className="h-8 w-36 text-right text-sm"
                    value={incomeText ? `₩ ${incomeText}` : ""}
                    placeholder="₩ 0"
                    onChange={(e) => setIncomeText(formatAmountInput(e.target.value))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void saveIncome();
                      if (e.key === "Escape") setEditingIncome(false);
                    }}
                  />
                  <Button size="sm" className="h-8" disabled={savingIncome} onClick={saveIncome}>
                    {savingIncome && <Loader2 className="animate-spin" />}
                    저장
                  </Button>
                </span>
              ) : (
                <button
                  type="button"
                  disabled={!canWrite}
                  onClick={() => {
                    setIncomeText(
                      budgetValue > 0 ? budgetValue.toLocaleString("ko-KR") : "",
                    );
                    setEditingIncome(true);
                  }}
                  className={cn(
                    "flex items-center gap-1.5 text-xl font-bold text-blue-600 dark:text-blue-400",
                    canWrite && "hover:underline decoration-dotted underline-offset-4",
                  )}
                >
                  {krw.format(budgetValue)}원
                  {canWrite && <Pencil className="h-3.5 w-3.5 text-muted-foreground" />}
                </button>
              )}
            </span>

            <span className="flex w-full items-baseline gap-2 md:w-auto">
              <span className="w-24 shrink-0 text-sm text-muted-foreground md:w-auto">
                {monthLabel}월 고정비
              </span>
              <span className="text-xl font-bold text-primary">
                -{krw.format(summary.total)}원
              </span>
            </span>

            <span className="flex w-full items-baseline gap-2 md:w-auto">
              <span className="w-24 shrink-0 text-sm text-muted-foreground md:w-auto">
                남는 금액
              </span>
              <span
                className={cn(
                  "text-xl font-bold",
                  budgetValue - summary.total < 0 && "text-destructive",
                )}
              >
                {krw.format(budgetValue - summary.total)}원
              </span>
            </span>
          </div>

          <p className="text-xs text-muted-foreground">
            납부 진행 · 완료{" "}
            <span className="font-semibold text-secondary-foreground">
              {krw.format(summary.paid)}원
            </span>
            {" / 미납 "}
            <span
              className={cn(
                "font-semibold",
                summary.pending > 0 ? "text-primary" : "text-muted-foreground",
              )}
            >
              {krw.format(summary.pending)}원
            </span>
          </p>
        </CardContent>
      </Card>

      {/* ---------- 용도별 / 자산별 요약 ---------- */}
      {thisMonth.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2">
          <Card>
            <CardHeader className="px-4 pb-1.5 pt-3.5">
              <CardTitle className="text-base">용도별 요약</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 px-4 pb-3.5 pt-0">
              {[...purposeTotals.entries()]
                .sort((a, b) => b[1] - a[1])
                .map(([key, total]) => {
                  const purpose = FC_PURPOSE_MAP[key as keyof typeof FC_PURPOSE_MAP];
                  return (
                    <div key={key} className="flex items-center gap-2 text-sm">
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
                          purpose.badge,
                        )}
                      >
                        {purpose.label}
                      </span>
                      <span className="h-px flex-1 bg-border" />
                      <span className="shrink-0 font-semibold">
                        {krw.format(total)}원
                      </span>
                    </div>
                  );
                })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="px-4 pb-1.5 pt-3.5">
              <CardTitle className="text-base">자산별 요약</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 px-4 pb-3.5 pt-0">
              {[...assetTotals.entries()]
                .sort((a, b) => b[1] - a[1])
                .map(([assetId, total]) => {
                  const asset = assetId ? assetById.get(assetId) : null;
                  const groupColor = asset
                    ? ASSET_GROUP_MAP[asset.group_key as AssetGroupKey]?.color
                    : "#B0A89E";
                  return (
                    <div key={assetId || "none"} className="flex items-center gap-2 text-sm">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: groupColor }}
                      />
                      <span className="shrink-0 font-medium">
                        {asset
                          ? asset.institution
                            ? `${asset.institution} · ${asset.name}`
                            : asset.name
                          : "자산 미지정"}
                      </span>
                      <span className="h-px flex-1 bg-border" />
                      <span className="shrink-0 font-semibold">
                        {krw.format(total)}원
                      </span>
                    </div>
                  );
                })}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ---------- 밀린 납부 ---------- */}
      {overdue.length > 0 && (
        <section className="space-y-1.5">
          <h2 className="px-0.5 text-sm font-semibold text-destructive">밀린 납부</h2>
          <ul className="divide-y rounded-xl border border-destructive/30 bg-card">
            {overdue.map((occ) => (
              <OccurrenceRow key={occ.id} occ={occ} showOverdue />
            ))}
          </ul>
        </section>
      )}

      {/* ---------- 구성원/공동 섹션 ---------- */}
      {thisMonth.length === 0 && tabFixedCosts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <ReceiptText className="h-7 w-7" />
            </span>
            <div>
              <p className="font-semibold">
                {tab === "personal"
                  ? "나만 보는 예산 항목이 없어요"
                  : "등록된 고정비가 없어요"}
              </p>
              <p className="text-sm text-muted-foreground">
                {tab === "personal"
                  ? "용돈 지출, 개인 구독처럼 혼자 관리할 항목을 등록해 보세요."
                  : "월세, 보험, 구독, 적금까지 — 매달 나가는 돈을 등록하고 체크해 보세요."}
              </p>
            </div>
            {canWrite && (
              <Button onClick={openCreate}>
                <Plus />
                {tab === "personal" ? "첫 내 항목 추가하기" : "첫 고정비 추가하기"}
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        sections.map((section) => (
          <section key={section.key} className="space-y-1.5">
            <div className="flex items-baseline justify-between px-0.5">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold">
                {section.color && (
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: section.color }}
                  />
                )}
                {section.label}
                <span className="text-xs font-normal text-muted-foreground">
                  {section.items.length}건
                </span>
              </h2>
              <span className="text-sm font-semibold">
                {krw.format(section.subtotal)}원
              </span>
            </div>
            <ul className="divide-y rounded-xl border bg-card">
              {section.items.map((occ) => (
                <OccurrenceRow key={occ.id} occ={occ} showOverdue />
              ))}
            </ul>
          </section>
        ))
      )}

      {/* ---------- 이번 달 발생 없는 고정비 ---------- */}
      {noOccurrence.length > 0 && (
        <section className="space-y-1.5">
          <h2 className="px-0.5 text-sm font-semibold text-muted-foreground">
            이번 달 해당 없음
          </h2>
          <ul className="divide-y rounded-xl border bg-card">
            {noOccurrence.map((fc) => {
              const purpose = FC_PURPOSE_MAP[fc.purpose];
              return (
                <li key={fc.id} className="flex items-center gap-2.5 px-3 py-2.5 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate font-medium">{fc.name}</span>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                          purpose.badge,
                        )}
                      >
                        {purpose.label}
                      </span>
                      {!fc.is_active && (
                        <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          비활성
                        </span>
                      )}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {fc.cycle_months === 1
                        ? "매월"
                        : fc.cycle_months === 12
                          ? "매년"
                          : `${fc.cycle_months}개월마다`}{" "}
                      · {fc.due_day === 0 ? "말일" : `${fc.due_day}일`}
                      {fc.asset_id && assetById.get(fc.asset_id) && (
                        <> · {assetById.get(fc.asset_id)!.name}</>
                      )}
                    </span>
                  </span>
                  <span className="shrink-0 font-bold">
                    {krw.format(Number(fc.amount))}원
                  </span>
                  {canWrite && (
                    <button
                      type="button"
                      aria-label="고정비 수정"
                      onClick={() => openEdit(fc)}
                      className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* ---------- 납부 날짜 확인 모달 ---------- */}
      <Modal
        open={payTarget !== null}
        onClose={() => setPayTarget(null)}
        title="납부 완료 처리"
      >
        {payTarget && (
          <div className="space-y-4">
            <p className="text-sm">
              <span className="font-semibold">
                {fcById.get(payTarget.fixed_cost_id)?.name}
              </span>{" "}
              {krw.format(Number(payTarget.amount))}원을 납부 완료로 표시할까요?
            </p>
            <div className="space-y-2">
              <Label htmlFor="payDate">기록 날짜</Label>
              <Input
                id="payDate"
                type="date"
                value={payDate}
                onChange={(e) => setPayDate(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                기본값은 납부 예정일이에요. 실제 납부한 날로 바꿀 수 있어요. 가계부에는
                자동으로 기록되지 않아요.
              </p>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button
              className="h-10 w-full"
              disabled={busyId !== null}
              onClick={confirmPay}
            >
              {busyId !== null && <Loader2 className="animate-spin" />}
              납부 완료
            </Button>
          </div>
        )}
      </Modal>

      <FixedCostFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        familyId={familyId}
        currentUserId={currentUserId}
        members={members}
        assets={assets.filter((a) =>
          tab === "personal" ? a.is_private : !a.is_private,
        )}
        editing={editing}
        recordPrivate={tab === "personal"}
      />
    </div>
  );
}
