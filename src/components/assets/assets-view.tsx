"use client";

import { useMemo, useState } from "react";
import { Landmark, Lock, Pencil, Plus } from "lucide-react";

import { AssetFormModal } from "@/components/assets/asset-form-modal";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ASSET_GROUPS,
  ASSET_GROUP_MAP,
  type Asset,
  type FamilyMemberLite,
} from "@/lib/asset-constants";
import { cn } from "@/lib/utils";

const krw = new Intl.NumberFormat("ko-KR");

type Props = {
  familyId: string;
  currentUserId: string;
  assets: Asset[];
  members: FamilyMemberLite[];
  canEdit: boolean;
};

export function AssetsView({ familyId, currentUserId, assets, members, canEdit }: Props) {
  const [tab, setTab] = useState<"family" | "mine">("family");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Asset | null>(null);
  const [editMode, setEditMode] = useState(false);

  const memberById = useMemo(
    () => new Map(members.map((m) => [m.user_id, m])),
    [members],
  );

  const visibleAssets = useMemo(
    () => assets.filter((a) => (tab === "family" ? !a.is_private : a.is_private)),
    [assets, tab],
  );

  const { assetTotal, debtTotal, grouped } = useMemo(() => {
    let assetTotal = 0;
    let debtTotal = 0;
    const grouped = new Map<string, { items: Asset[]; subtotal: number }>();

    for (const asset of visibleAssets) {
      const group = ASSET_GROUP_MAP[asset.group_key];
      const amount = Number(asset.amount);
      if (group?.isLiability) debtTotal += amount;
      else assetTotal += amount;

      const bucket = grouped.get(asset.group_key) ?? { items: [], subtotal: 0 };
      bucket.items.push(asset);
      bucket.subtotal += amount;
      grouped.set(asset.group_key, bucket);
    }
    return { assetTotal, debtTotal, grouped };
  }, [visibleAssets]);

  const net = assetTotal - debtTotal;

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }

  function onAssetClick(asset: Asset) {
    if (editMode && canEdit) {
      setEditing(asset);
      setModalOpen(true);
      setEditMode(false);
    }
    // TODO(가계부 이식 후): 해당 자산으로 필터된 가계부로 이동 복원
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold">자산</h1>
        <div className="hidden items-center gap-1.5 md:flex">
          {canEdit && (
            <Button
              variant={editMode ? "default" : "outline"}
              size="sm"
              onClick={() => setEditMode((v) => !v)}
            >
              <Pencil />
              {editMode ? "수정할 자산을 선택하세요" : "자산 수정"}
            </Button>
          )}
          {canEdit && (
            <Button size="sm" onClick={openCreate}>
              <Plus />
              자산 추가
            </Button>
          )}
        </div>
      </header>

      {/* ---------- 가족/내 자산 탭 (모바일: 요약과 같은 전체 폭) ---------- */}
      <div className="grid w-full grid-cols-2 gap-1 rounded-lg border bg-card p-1 md:w-fit">
        {(
          [
            { key: "family", label: "가족 자산" },
            { key: "mine", label: "🔒 내 자산" },
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

      {/* ---------- 모바일: 수정/추가 버튼 행 ---------- */}
      {canEdit && (
      <div className="grid grid-cols-2 gap-1.5 md:hidden">
        {canEdit && (
          <>
            <Button
              variant={editMode ? "default" : "outline"}
              size="sm"
              onClick={() => setEditMode((v) => !v)}
            >
              <Pencil />
              {editMode ? "선택하세요" : "자산 수정"}
            </Button>
            <Button size="sm" onClick={openCreate}>
              <Plus />
              자산 추가
            </Button>
          </>
        )}
      </div>
      )}

      {/* ---------- 순자산 요약 한 줄 ---------- */}
      <Card>
        <CardContent className="flex flex-wrap items-baseline gap-x-5 gap-y-1.5 p-4 md:p-5">
          <span className="flex w-full items-baseline gap-2 md:w-auto">
            <span className="w-12 shrink-0 text-sm text-muted-foreground md:w-auto">
              순자산
            </span>
            <span className={cn("text-xl font-bold", net < 0 && "text-destructive")}>
              {krw.format(net)}원
            </span>
          </span>
          <span className="flex w-full items-baseline gap-2 md:w-auto">
            <span className="w-12 shrink-0 text-sm text-muted-foreground md:w-auto">
              자산
            </span>
            <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
              {krw.format(assetTotal)}원
            </span>
          </span>
          <span className="flex w-full items-baseline gap-2 md:w-auto">
            <span className="w-12 shrink-0 text-sm text-muted-foreground md:w-auto">
              부채
            </span>
            <span className="text-xl font-bold text-destructive">
              {krw.format(debtTotal)}원
            </span>
          </span>
        </CardContent>
      </Card>

      {/* ---------- 그룹별 목록 ---------- */}
      {visibleAssets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Landmark className="h-7 w-7" />
            </span>
            <div>
              <p className="font-semibold">
                {tab === "mine"
                  ? "아직 나만 보는 자산이 없어요"
                  : "아직 등록된 자산이 없어요"}
              </p>
              <p className="text-sm text-muted-foreground">
                {tab === "mine"
                  ? "용돈 계좌처럼 혼자 관리하고 싶은 자산을 추가해 보세요."
                  : "통장, 카드, 투자, 대출까지 한곳에 모아 관리해 보세요."}
              </p>
            </div>
            {canEdit && (
              <Button onClick={openCreate}>
                <Plus />첫 자산 추가하기
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        ASSET_GROUPS.filter((g) => grouped.has(g.key)).map((group) => {
          const bucket = grouped.get(group.key)!;
          return (
            <section key={group.key} className="space-y-2">
              <div className="flex items-baseline justify-between px-0.5">
                <h2 className="text-sm font-semibold">
                  {group.label}
                  <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                    {bucket.items.length}개
                  </span>
                </h2>
                <span
                  className={cn(
                    "text-sm font-semibold",
                    group.isLiability && "text-destructive",
                  )}
                >
                  {group.isLiability ? "-" : ""}
                  {krw.format(bucket.subtotal)}원
                </span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {bucket.items.map((asset) => {
                  const owner = asset.owner_user_id
                    ? memberById.get(asset.owner_user_id)
                    : null;
                  return (
                    <button
                      key={asset.id}
                      type="button"
                      onClick={() => onAssetClick(asset)}
                      className={cn(
                        "flex items-center gap-3 rounded-xl border bg-card p-3.5 text-left shadow-sm transition-colors hover:bg-muted/40",
                        editMode
                          ? "border-primary/60 ring-1 ring-primary/30"
                          : "hover:border-primary/40",
                      )}
                    >
                      {/* 로고 자리: 추후 기관 로고 이미지로 교체 */}
                      <span
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                        style={{ backgroundColor: group.color }}
                      >
                        {(asset.institution || asset.name).slice(0, 1)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs text-muted-foreground">
                          {asset.institution || group.label}
                          {owner && (
                            <>
                              {" · "}
                              <span
                                className="mx-0.5 inline-block h-2 w-2 rounded-full align-baseline"
                                style={{ backgroundColor: owner.color }}
                              />
                              {owner.display_name}
                            </>
                          )}
                        </span>
                        <span className="flex items-center gap-1 truncate text-sm font-medium">
                          <span className="truncate">{asset.name}</span>
                          {asset.is_private && (
                            <Lock className="h-3 w-3 shrink-0 text-muted-foreground" />
                          )}
                        </span>
                        <span className="block text-[11px] text-muted-foreground">
                          {new Date(asset.balance_date).toLocaleDateString("ko-KR", {
                            month: "long",
                            day: "numeric",
                          })}{" "}
                          기준
                          {asset.maturity_on && (
                            <span className="text-emerald-700 dark:text-emerald-400">
                              {" · 만기 "}
                              {new Date(asset.maturity_on).toLocaleDateString("ko-KR", {
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                              })}
                            </span>
                          )}
                        </span>
                      </span>
                      <span
                        className={cn(
                          "shrink-0 text-sm font-bold",
                          group.isLiability && "text-destructive",
                        )}
                      >
                        {group.isLiability ? "-" : ""}
                        {krw.format(Number(asset.amount))}원
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })
      )}

      <AssetFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        familyId={familyId}
        currentUserId={currentUserId}
        members={members}
        editing={editing}
        defaultPrivate={tab === "mine"}
      />
    </div>
  );
}
