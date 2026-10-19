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
import type { AssetLite, Category, Transaction, TransferTarget } from "@/lib/ledger-constants";
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

  const filteredTransactions = useMemo(() => {
    let list = transactions.filter((tx) =>
      tab === "family" ? !tx.is_private : tx.is_private,
    );
    if (assetFilter) {
      list = list.filter(
        (tx) => tx.asset_id === assetFilter || tx.to_asset_id === assetFilter,
      );
    }
    return list;
  }, [transactions, assetFilter, tab]);

  const { income, expense, byDate } = useMemo(() => {
    let income = 0;
    let expense = 0;
    const byDate = new Map<
      string,
      { items: Transaction[]; income: number; expense: number }
    >();

    for (const tx of filteredTransactions) {
      const amt = Number(tx.amount);
      if (tx.type === "income") income += amt;
      if (tx.type === "expense") expense += amt;

      const bucket =
        byDate.get(tx.occurred_on) ?? { items: [], income: 0, expense: 0 };
      bucket.items.push(tx);
      if (tx.type === "income") bucket.income += amt;
      if (tx.type === "expense") bucket.expense += amt;
      byDate.set(tx.occurred_on, bucket);
    }
    return { income, expense, byDate };
  }, [filteredTransactions]);

  const [year, monthNum] = month.split("-").map(Number);
  const dates = [...byDate.keys()].sort((a, b) => (a < b ? 1 : -1));

  const canWrite = tab === "personal" ? true : canEdit;

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(tx: Transaction) {
    if (!canWrite) return;
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
          <dl className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-muted/50 py-2.5">
              <dt className="text-xs text-muted-foreground">수입</dt>
              <dd className="text-base font-bold text-blue-600 dark:text-blue-400">
                {krw.format(income)}원
              </dd>
            </div>
            <div className="rounded-lg bg-muted/50 py-2.5">
              <dt className="text-xs text-muted-foreground">지출</dt>
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
          </dl>
        </CardContent>
      </Card>

      {/* ---------- 거래 목록 ---------- */}
      {filteredTransactions.length === 0 ? (
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
                  <span className="flex items-baseline gap-2 text-xs">
                    {bucket.income > 0 && (
                      <span className="text-muted-foreground">
                        수입{" "}
                        <span className="font-semibold text-blue-600 dark:text-blue-400">
                          +{krw.format(bucket.income)}원
                        </span>
                      </span>
                    )}
                    {bucket.expense > 0 && (
                      <span className="text-muted-foreground">
                        지출{" "}
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
                  </span>
                </div>
                <div className="divide-y rounded-xl border bg-card">
                  {bucket.items.map((tx) => {
                    const category = tx.category_id
                      ? categoryById.get(tx.category_id)
                      : null;
                    const asset = tx.asset_id ? assetById.get(tx.asset_id) : null;
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
                        disabled={!canWrite}
                        className={cn(
                          "flex w-full items-center gap-3 px-3.5 py-3 text-left",
                          canWrite && "hover:bg-muted/40",
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
                            tx.type === "income" &&
                              "text-blue-600 dark:text-blue-400",
                            tx.type === "expense" && "text-foreground",
                            tx.type === "transfer" && "text-muted-foreground",
                          )}
                        >
                          {tx.type === "income" ? "+" : tx.type === "expense" ? "-" : ""}
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
