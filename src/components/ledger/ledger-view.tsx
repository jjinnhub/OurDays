"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowRight, BarChart3, ChevronLeft, ChevronRight, Plus, Settings2, Wallet } from "lucide-react";

import { CategoryManagerModal } from "@/components/ledger/category-manager-modal";
import { TransactionFormModal } from "@/components/ledger/transaction-form-modal";
import { Button } from "@/components/ui/button";
import { SelectBox } from "@/components/ui/select-box";
import { Card, CardContent } from "@/components/ui/card";
import type { FamilyMemberLite } from "@/lib/asset-constants";
import type { AssetLite, Category, FlowTx, InboundTransfer, Transaction, TransferTarget } from "@/lib/ledger-constants";
import { cn } from "@/lib/utils";

const krw = new Intl.NumberFormat("ko-KR");

type Props = {
  familyId: string;
  currentUserId: string;
  month: string; // YYYY-MM
  transactions: Transaction[];
  categories: Category[];
  assets: AssetLite[];
  members: FamilyMemberLite[];
  canEdit: boolean;
  openOnMount: boolean;
  initialAssetFilter?: string;
  initialTab?: "family" | "personal";
  transferTargets: TransferTarget[];
  flowTransactions: FlowTx[];
  inboundTransfers: InboundTransfer[];
};

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function LedgerView({
  familyId,
  currentUserId,
  month,
  transactions,
  categories,
  assets,
  members,
  canEdit,
  openOnMount,
  initialAssetFilter = "",
  initialTab = "family",
  transferTargets,
  flowTransactions,
  inboundTransfers,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false);
  const [assetFilter, setAssetFilter] = useState(initialAssetFilter); // ""=전체
  const [tab, setTab] = useState<"family" | "personal">(initialTab);

  // 하단 ➕ 버튼(/ledger?add=1)으로 진입하면 바로 입력 모달
  useEffect(() => {
    if (openOnMount && canEdit) {
      setModalOpen(true);
      router.replace(pathname, { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openOnMount]);

  const categoryById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );
  const assetById = useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets]);
  const tabAssets = useMemo(
    () => assets.filter((a) => (tab === "family" ? !a.is_private : a.is_private)),
    [assets, tab],
  );
  const targetById = useMemo(
    () => new Map(transferTargets.map((t) => [t.id, t])),
    [transferTargets],
  );
  const memberById = useMemo(
    () => new Map(members.map((m) => [m.user_id, m])),
    [members],
  );

  type RowItem = { tx: Transaction; flow: "in" | "out" | null; readonly: boolean };

  const myPrivateAssetIds = useMemo(
    () => new Set(assets.filter((a) => a.is_private).map((a) => a.id)),
    [assets],
  );

  /** 자산 공개 여부 — 목록에 없으면 타인 개인 자산으로 간주 */
  const isPrivateAsset = (id: string | null): boolean => {
    if (!id) return false;
    const asset = assetById.get(id);
    if (asset) return !!asset.is_private;
    const target = targetById.get(id);
    if (target) return target.is_private;
    return true;
  };

  /** 현재 탭·자산 필터 기준의 입금/출금 분류 (null = 중립 이동) */
  const flowFor = (row: {
    type: Transaction["type"];
    asset_id: string | null;
    to_asset_id: string | null;
    is_private: boolean;
  }): "in" | "out" | null => {
    if (assetFilter) {
      if (row.type === "income") return row.asset_id === assetFilter ? "in" : null;
      if (row.type === "expense") return row.asset_id === assetFilter ? "out" : null;
      if (row.to_asset_id === assetFilter) return "in";
      if (row.asset_id === assetFilter) return "out";
      return null;
    }
    if (row.type === "income") return "in";
    if (row.type === "expense") return "out";
    if (tab === "family") {
      // 개인→공동 유입 이체는 is_private=true로 들어온다
      if (row.is_private) return "in";
      return isPrivateAsset(row.to_asset_id) ? "out" : null; // 공동→개인(용돈)만 출금
    }
    // 개인 탭
    if (!row.is_private) return "in"; // 공동→내 개인 (수신 전용 행)
    return isPrivateAsset(row.to_asset_id) ? null : "out"; // 내 개인→공동만 출금
  };

  const touches = (row: { asset_id: string | null; to_asset_id: string | null }) =>
    !assetFilter || row.asset_id === assetFilter || row.to_asset_id === assetFilter;

  const monthStart = `${month}-01`;
  const nextMonthStart = (() => {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  })();

  const inboundAsTx = useMemo(
    () =>
      inboundTransfers.map(
        (t): Transaction => ({
          id: t.id,
          type: "transfer",
          title: t.title,
          amount: t.amount,
          occurred_on: t.occurred_on,
          category_id: null,
          asset_id: t.from_asset_id,
          to_asset_id: t.to_asset_id,
          member_user_id: t.member_user_id,
          memo: t.memo,
          recur_group_id: null,
          recur_rule: null,
          is_private: true,
        }),
      ),
    [inboundTransfers],
  );

  // 이번 달 표시 대상 (탭별 유니버스 + 자산 필터)
  const monthItems = useMemo((): RowItem[] => {
    const items: RowItem[] = [];
    if (tab === "family") {
      for (const tx of transactions) {
        if (tx.is_private || !touches(tx)) continue;
        items.push({ tx, flow: flowFor(tx), readonly: false });
      }
      for (const tx of inboundAsTx) {
        if (tx.occurred_on < monthStart || tx.occurred_on >= nextMonthStart) continue;
        if (!touches(tx)) continue;
        items.push({ tx, flow: flowFor(tx), readonly: true });
      }
    } else {
      for (const tx of transactions) {
        if (tx.is_private) {
          if (!touches(tx)) continue;
          items.push({ tx, flow: flowFor(tx), readonly: false });
        } else if (
          tx.type === "transfer" &&
          tx.to_asset_id &&
          myPrivateAssetIds.has(tx.to_asset_id)
        ) {
          // 공동→내 개인 수신 (가족 기록, 읽기 전용)
          if (!touches(tx)) continue;
          items.push({ tx, flow: flowFor(tx), readonly: true });
        }
      }
    }
    return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, inboundAsTx, tab, assetFilter, myPrivateAssetIds, monthStart, nextMonthStart]);

  // 잔액 기초: 현재 범위 자산들의 실제 잔액에 정합하도록
  // (비거래 기초 = 자산 잔액 합 − 전체 기간 흐름 합) + 월초 이전 흐름
  const cumulativeBase = useMemo(() => {
    let flowsAll = 0;
    let flowsBeforeMonth = 0;
    const apply = (
      row: {
        type: Transaction["type"];
        amount: number | string;
        occurred_on: string;
        asset_id: string | null;
        to_asset_id: string | null;
        is_private: boolean;
      },
    ) => {
      if (!touches(row)) return;
      const flow = flowFor(row);
      if (!flow) return;
      const delta = flow === "in" ? Number(row.amount) : -Number(row.amount);
      flowsAll += delta;
      if (row.occurred_on < monthStart) flowsBeforeMonth += delta;
    };

    if (tab === "family") {
      for (const row of flowTransactions) if (!row.is_private) apply(row);
      for (const t of inboundTransfers) {
        apply({
          type: "transfer",
          amount: t.amount,
          occurred_on: t.occurred_on,
          asset_id: t.from_asset_id,
          to_asset_id: t.to_asset_id,
          is_private: true,
        });
      }
    } else {
      for (const row of flowTransactions) {
        if (row.is_private) apply(row);
        else if (
          row.type === "transfer" &&
          row.to_asset_id &&
          myPrivateAssetIds.has(row.to_asset_id)
        )
          apply(row);
      }
    }

    // 범위 자산 잔액 합 (초기 금액·수동 보정 포함)
    let balanceSum = 0;
    for (const a of assets) {
      if (assetFilter) {
        if (a.id !== assetFilter) continue;
      } else if (tab === "family" ? a.is_private : !a.is_private) {
        continue;
      }
      balanceSum += Number(a.amount ?? 0);
    }

    const nonTxBase = balanceSum - flowsAll; // 초기 금액 + 수동 보정분
    return nonTxBase + flowsBeforeMonth;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flowTransactions, inboundTransfers, assets, tab, assetFilter, myPrivateAssetIds, monthStart]);

  const { income, expense, byDate, cumulativeEnd } = useMemo(() => {
    let income = 0;
    let expense = 0;
    const byDate = new Map<
      string,
      { items: RowItem[]; income: number; expense: number; cumulative: number }
    >();

    for (const item of monthItems) {
      const amt = Number(item.tx.amount);
      if (item.flow === "in") income += amt;
      if (item.flow === "out") expense += amt;

      const bucket =
        byDate.get(item.tx.occurred_on) ??
        { items: [], income: 0, expense: 0, cumulative: 0 };
      bucket.items.push(item);
      if (item.flow === "in") bucket.income += amt;
      if (item.flow === "out") bucket.expense += amt;
      byDate.set(item.tx.occurred_on, bucket);
    }

    // 일자 오름차순으로 누적 계산
    let running = cumulativeBase;
    for (const dateStr of [...byDate.keys()].sort()) {
      const bucket = byDate.get(dateStr)!;
      running += bucket.income - bucket.expense;
      bucket.cumulative = running;
    }
    return { income, expense, byDate, cumulativeEnd: running };
  }, [monthItems, cumulativeBase]);

  const [year, monthNum] = month.split("-").map(Number);
  const dates = [...byDate.keys()].sort((a, b) => (a < b ? 1 : -1));

  const canWrite = tab === "personal" ? true : canEdit;

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(tx: Transaction) {
    if (!canWrite) return;
    // 읽기 전용 행: 가족 탭의 유입 이체 / 개인 탭의 공동→내 자산 수신
    if (tab === "family" ? tx.is_private : !tx.is_private) return;
    setEditing(tx);
    setModalOpen(true);
  }

  return (
    <div className="space-y-4">
      {/* 모바일: 제목 / 자산 선택 / 버튼 3개를 각각 한 줄로. 데스크톱: 기존 한 줄 유지 */}
      <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <h1 className="text-xl font-bold">가계부</h1>
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-1.5">
          {/* 모바일: 1행 가족/개인 탭 (드롭박스와 같은 전체 폭) */}
          <div className="grid w-full grid-cols-2 gap-1 rounded-lg border bg-card p-1 md:hidden">
            {(
              [
                { key: "family", label: "가족 가계부" },
                { key: "personal", label: "🔒 개인 가계부" },
              ] as const
            ).map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => {
                  setTab(t.key);
                  setAssetFilter("");
                }}
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
          <div className="w-full md:w-56">
            <SelectBox
              value={assetFilter}
              onChange={setAssetFilter}
              placeholder="전체 자산"
              className="h-9 px-2.5 text-xs md:h-8 md:text-xs"
              options={[
                { value: "", label: "전체 자산" },
                ...tabAssets.map((a) => ({
                  value: a.id,
                  label: a.institution ? `${a.institution} · ${a.name}` : a.name,
                })),
              ]}
            />
          </div>
          <div
            className={cn(
              "grid gap-1.5 md:flex md:items-center",
              canWrite ? "grid-cols-3" : "grid-cols-1",
            )}
          >
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/stats?tab=ledger&month=${month}`)}
            >
              <BarChart3 />
              통계
            </Button>
            {canWrite && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCategoryManagerOpen(true)}
                >
                  <Settings2 />
                  카테고리
                </Button>
                <Button size="sm" onClick={openCreate}>
                  <Plus />
                  거래 입력
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ---------- 가족/개인 탭 (데스크톱) ---------- */}
      <div className="hidden w-fit grid-cols-2 gap-1 rounded-lg border bg-card p-1 md:grid">
        {(
          [
            { key: "family", label: "가족 가계부" },
            { key: "personal", label: "🔒 개인 가계부" },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              setTab(t.key);
              setAssetFilter("");
            }}
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

      {/* ---------- 월 네비게이션 + 요약 ---------- */}
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center justify-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              aria-label="이전 달"
              onClick={() => router.push(`${pathname}?month=${shiftMonth(month, -1)}`)}
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
              onClick={() => router.push(`${pathname}?month=${shiftMonth(month, 1)}`)}
            >
              <ChevronRight />
            </Button>
          </div>
          <dl className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
            <div className="rounded-lg bg-muted/50 py-2.5">
              <dt className="text-xs text-muted-foreground">입금</dt>
              <dd className="text-base font-bold text-blue-600 dark:text-blue-400">
                {krw.format(income)}원
              </dd>
            </div>
            <div className="rounded-lg bg-muted/50 py-2.5">
              <dt className="text-xs text-muted-foreground">출금</dt>
              <dd className="text-base font-bold text-primary">
                {krw.format(expense)}원
              </dd>
            </div>
            <div className="rounded-lg bg-muted/50 py-2.5">
              <dt className="text-xs text-muted-foreground">합계</dt>
              <dd
                className={cn(
                  "text-base font-bold",
                  income - expense < 0 && "text-destructive",
                )}
              >
                {krw.format(income - expense)}원
              </dd>
            </div>
            <div className="rounded-lg bg-muted/50 py-2.5">
              <dt className="text-xs text-muted-foreground">잔액</dt>
              <dd
                className={cn(
                  "text-base font-bold",
                  cumulativeEnd < 0 && "text-destructive",
                )}
              >
                {krw.format(cumulativeEnd)}원
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* ---------- 거래 목록 ---------- */}
      {monthItems.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Wallet className="h-7 w-7" />
            </span>
            <div>
              <p className="font-semibold">
                {assetFilter
                  ? "이 자산의 거래가 없어요"
                  : tab === "personal"
                    ? "이번 달 개인 거래가 없어요"
                    : "이번 달 거래가 없어요"}
              </p>
              <p className="text-sm text-muted-foreground">
                {assetFilter
                  ? "다른 자산을 선택하거나 전체 자산으로 돌아가 보세요."
                  : "첫 지출을 입력하면 자산 잔액도 함께 움직여요."}
              </p>
            </div>
            {canWrite && (
              <Button onClick={openCreate}>
                <Plus />
                거래 입력하기
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {dates.map((dateStr) => {
            const bucket = byDate.get(dateStr)!;
            const d = new Date(dateStr);
            return (
              <section key={dateStr}>
                <div className="flex items-baseline justify-between px-1 pb-1.5">
                  <h2 className="text-sm font-semibold">
                    {d.getDate()}일{" "}
                    <span className="text-xs font-normal text-muted-foreground">
                      {d.toLocaleDateString("ko-KR", { weekday: "short" })}
                    </span>
                  </h2>
                  <span className="flex flex-wrap items-baseline justify-end gap-x-2 gap-y-0.5 text-xs">
                    {bucket.income > 0 && (
                      <span className="text-muted-foreground">
                        입금{" "}
                        <span className="font-semibold text-blue-600 dark:text-blue-400">
                          +{krw.format(bucket.income)}원
                        </span>
                      </span>
                    )}
                    {bucket.expense > 0 && (
                      <span className="text-muted-foreground">
                        출금{" "}
                        <span className="font-semibold text-primary">
                          -{krw.format(bucket.expense)}원
                        </span>
                      </span>
                    )}
                    <span className="text-muted-foreground">
                      합계{" "}
                      <span
                        className={cn(
                          "font-semibold",
                          bucket.income - bucket.expense < 0
                            ? "text-foreground"
                            : "text-blue-600 dark:text-blue-400",
                        )}
                      >
                        {krw.format(bucket.income - bucket.expense)}원
                      </span>
                    </span>
                    <span className="text-muted-foreground">
                      잔액{" "}
                      <span
                        className={cn(
                          "font-semibold",
                          bucket.cumulative < 0 && "text-destructive",
                        )}
                      >
                        {krw.format(bucket.cumulative)}원
                      </span>
                    </span>
                  </span>
                </div>
                <div className="divide-y rounded-xl border bg-card">
                  {bucket.items.map(({ tx, flow, readonly }) => {
                    const category = tx.category_id
                      ? categoryById.get(tx.category_id)
                      : null;
                    const assetRaw = tx.asset_id ? assetById.get(tx.asset_id) : null;
                    const fromTarget =
                      !assetRaw && tx.asset_id ? targetById.get(tx.asset_id) : null;
                    const asset =
                      assetRaw ??
                      (fromTarget
                        ? {
                            name: `🔒 ${
                              memberById.get(fromTarget.owner_user_id ?? "")
                                ?.display_name ?? ""
                            } ${fromTarget.name}`.trim(),
                          }
                        : null);
                    const toAssetRaw = tx.to_asset_id
                      ? assetById.get(tx.to_asset_id)
                      : null;
                    const toTarget =
                      !toAssetRaw && tx.to_asset_id
                        ? targetById.get(tx.to_asset_id)
                        : null;
                    const toAsset =
                      toAssetRaw ??
                      (toTarget
                        ? {
                            name: `🔒 ${
                              memberById.get(toTarget.owner_user_id ?? "")
                                ?.display_name ?? ""
                            } ${toTarget.institution ? `${toTarget.institution} ` : ""}${toTarget.name}`.trim(),
                          }
                        : null);
                    const member = tx.member_user_id
                      ? memberById.get(tx.member_user_id)
                      : null;
                    const amt = Number(tx.amount);

                    return (
                      <button
                        key={tx.id}
                        type="button"
                        onClick={() => openEdit(tx)}
                        disabled={!canWrite || readonly}
                        className={cn(
                          "flex w-full items-center gap-3 px-3.5 py-3 text-left",
                          canWrite && !readonly && "hover:bg-muted/40",
                        )}
                      >
                        <span
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base"
                          style={{
                            backgroundColor: `${category?.color ?? "#878787"}22`,
                          }}
                        >
                          {tx.type === "transfer" ? "🔁" : (category?.icon ?? "📌")}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">
                            {tx.title ||
                              (tx.type === "transfer"
                                ? "이체"
                                : (category?.name ?? "미분류"))}
                          </span>
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            {tx.type !== "transfer" && (
                              <span className="shrink-0">
                                {category?.name ?? "미분류"}
                              </span>
                            )}
                            {tx.memo && (
                              <span className="truncate">
                                {tx.type !== "transfer" && "· "}
                                {tx.memo}
                              </span>
                            )}
                            {member && (
                              <>
                                {(tx.type !== "transfer" || tx.memo) && "· "}
                                <span
                                  className="inline-block h-2 w-2 rounded-full"
                                  style={{ backgroundColor: member.color }}
                                />
                                {member.display_name}
                              </>
                            )}
                            {tx.type === "transfer" ? (
                              <span className="flex items-center gap-0.5 truncate">
                                {(tx.memo || member) && "· "}
                                {asset?.name ?? "?"}
                                <ArrowRight className="h-3 w-3" />
                                {toAsset?.name ?? "?"}
                              </span>
                            ) : (
                              asset && (
                                <span className="truncate">
                                  {(tx.memo || member) && "· "}
                                  {asset.name}
                                </span>
                              )
                            )}
                          </span>
                        </span>
                        <span
                          className={cn(
                            "shrink-0 text-sm font-bold",
                            flow === "in" && "text-blue-600 dark:text-blue-400",
                            flow === "out" && "text-foreground",
                            flow === null && "text-muted-foreground",
                          )}
                        >
                          {flow === "in" ? "+" : flow === "out" ? "-" : ""}
                          {krw.format(amt)}원
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <CategoryManagerModal
        open={categoryManagerOpen}
        onClose={() => setCategoryManagerOpen(false)}
        familyId={familyId}
        categories={categories}
      />

      <TransactionFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        familyId={familyId}
        currentUserId={currentUserId}
        categories={categories}
        assets={tabAssets}
        members={members}
        editing={editing}
        defaultAssetId={assetFilter}
        recordPrivate={tab === "personal"}
        transferTargetOptions={
          tab === "personal"
            ? [
                // 내 개인 자산
                ...tabAssets.map((a) => ({
                  value: a.id,
                  label: a.institution ? `${a.institution} · ${a.name}` : a.name,
                })),
                // 가족 공동 자산 (개인 -> 공동 이체용)
                ...assets
                  .filter((a) => !a.is_private)
                  .map((a) => ({
                    value: a.id,
                    label: `🏡 ${a.institution ? `${a.institution} · ` : ""}${a.name}`,
                  })),
              ]
            : transferTargets.map((t) => {
                if (!t.is_private) {
                  const a = assetById.get(t.id);
                  return {
                    value: t.id,
                    label: a?.institution ? `${a.institution} · ${a.name}` : t.name,
                  };
                }
                const owner = t.owner_user_id
                  ? memberById.get(t.owner_user_id)
                  : null;
                return {
                  value: t.id,
                  label: `🔒 ${owner ? `${owner.display_name} · ` : ""}${
                    t.institution ? `${t.institution} · ` : ""
                  }${t.name}`,
                };
              })
        }
      />
    </div>
  );
}
