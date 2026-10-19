"use client";

import { useMemo, useState } from "react";
import { Gift, Plus, Search, UserPlus } from "lucide-react";

import { ContactFormModal } from "@/components/gifts/contact-form-modal";
import { GiftRecordFormModal } from "@/components/gifts/gift-record-form-modal";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import type { FamilyMemberLite } from "@/lib/asset-constants";
import {
  GIFT_EVENT_TYPE_MAP,
  GIFT_RELATIONS,
  GIFT_RELATION_MAP,
  type Contact,
  type GiftRecord,
  type GiftRelationKey,
} from "@/lib/gift-constants";
import { cn } from "@/lib/utils";

const krw = new Intl.NumberFormat("ko-KR");

type Props = {
  familyId: string;
  contacts: Contact[];
  records: GiftRecord[];
  members: FamilyMemberLite[];
  canEdit: boolean;
};

export function GiftsView({ familyId, contacts, records, members, canEdit }: Props) {
  const [tab, setTab] = useState<"contacts" | "records">("contacts");
  const [thisYearOnly, setThisYearOnly] = useState(false);
  const [query, setQuery] = useState("");
  const [relationFilter, setRelationFilter] = useState<GiftRelationKey | null>(null);

  const [recordModalOpen, setRecordModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<GiftRecord | null>(null);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [detailContactId, setDetailContactId] = useState<string | null>(null);

  const year = String(new Date().getFullYear());
  const memberById = useMemo(
    () => new Map(members.map((m) => [m.user_id, m])),
    [members],
  );
  const contactById = useMemo(
    () => new Map(contacts.map((c) => [c.id, c])),
    [contacts],
  );

  const visibleRecords = useMemo(
    () =>
      thisYearOnly
        ? records.filter((r) => r.occurred_on.startsWith(year))
        : records,
    [records, thisYearOnly, year],
  );

  const { given, received, statsByContact } = useMemo(() => {
    let given = 0;
    let received = 0;
    const statsByContact = new Map<
      string,
      { given: number; received: number; last: string; count: number }
    >();
    for (const r of visibleRecords) {
      const amt = Number(r.amount);
      if (r.direction === "given") given += amt;
      else received += amt;
      const stat =
        statsByContact.get(r.contact_id) ??
        { given: 0, received: 0, last: "", count: 0 };
      if (r.direction === "given") stat.given += amt;
      else stat.received += amt;
      if (r.occurred_on > stat.last) stat.last = r.occurred_on;
      stat.count += 1;
      statsByContact.set(r.contact_id, stat);
    }
    return { given, received, statsByContact };
  }, [visibleRecords]);

  const filteredContacts = useMemo(() => {
    let list = contacts;
    const q = query.trim();
    if (q) {
      list = list.filter((c) => c.name.includes(q) || c.organization.includes(q));
    }
    if (relationFilter) list = list.filter((c) => c.relation === relationFilter);
    return [...list].sort((a, b) => {
      const la = statsByContact.get(a.id)?.last ?? "";
      const lb = statsByContact.get(b.id)?.last ?? "";
      return lb.localeCompare(la);
    });
  }, [contacts, query, relationFilter, statsByContact]);

  const filteredRecords = useMemo(() => {
    const q = query.trim();
    if (!q) return visibleRecords;
    return visibleRecords.filter((r) => {
      const c = contactById.get(r.contact_id);
      return c && (c.name.includes(q) || c.organization.includes(q));
    });
  }, [visibleRecords, query, contactById]);

  const detailContact = detailContactId ? contactById.get(detailContactId) : null;
  const detailRecords = useMemo(
    () =>
      detailContactId
        ? records
            .filter((r) => r.contact_id === detailContactId)
            .sort((a, b) => b.occurred_on.localeCompare(a.occurred_on))
        : [],
    [records, detailContactId],
  );

  function openRecordCreate(contactId?: string) {
    setEditingRecord(null);
    setRecordModalOpen(true);
    void contactId;
  }

  function RecordRow({ record, showName }: { record: GiftRecord; showName: boolean }) {
    const type = GIFT_EVENT_TYPE_MAP[record.event_type];
    const contact = contactById.get(record.contact_id);
    return (
      <button
        type="button"
        disabled={!canEdit}
        onClick={() => {
          setEditingRecord(record);
          setRecordModalOpen(true);
        }}
        className={cn(
          "flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left",
          canEdit && "hover:bg-muted/40",
        )}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-base">
          {type.icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-sm font-medium">
            <span className="truncate">
              {showName ? (contact?.name ?? "알 수 없음") : type.label}
            </span>
            {showName && (
              <span className="shrink-0 text-xs font-normal text-muted-foreground">
                {type.label}
              </span>
            )}
            {record.attended && (
              <span className="shrink-0 rounded-full bg-secondary/25 px-1.5 py-0.5 text-[10px] text-secondary-foreground">
                참석
              </span>
            )}
          </span>
          <span className="text-xs text-muted-foreground">
            {record.occurred_on.replaceAll("-", ".")}
            {record.memo && ` · ${record.memo}`}
          </span>
        </span>
        <span
          className={cn(
            "shrink-0 text-sm font-bold",
            record.direction === "given"
              ? "text-primary"
              : "text-blue-600 dark:text-blue-400",
          )}
        >
          {record.direction === "given" ? "-" : "+"}
          {krw.format(Number(record.amount))}원
        </span>
      </button>
    );
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">축의금</h1>
        {canEdit && (
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditingContact(null);
                setContactModalOpen(true);
              }}
            >
              <UserPlus />
              관계인 추가
            </Button>
            <Button size="sm" onClick={() => openRecordCreate()}>
              <Plus />
              기록하기
            </Button>
          </div>
        )}
      </header>

      {/* ---------- 요약 ---------- */}
      <Card>
        <CardContent className="flex flex-wrap items-baseline gap-x-5 gap-y-1.5 p-4 md:p-5">
          {/* 모바일: 한 줄씩 스택 + 라벨 폭 정렬, 데스크톱: 한 줄 */}
          <span className="flex w-full items-baseline gap-2 md:w-auto">
            <span className="w-16 shrink-0 text-sm text-muted-foreground md:w-auto">
              보낸 금액
            </span>
            <span className="text-xl font-bold text-primary">{krw.format(given)}원</span>
            <button
              type="button"
              onClick={() => setThisYearOnly((v) => !v)}
              className={cn(
                "ml-auto self-center rounded-full border px-2.5 py-1 text-xs font-medium md:hidden",
                thisYearOnly
                  ? "border-primary bg-primary/10"
                  : "bg-card text-muted-foreground hover:bg-muted",
              )}
            >
              올해만
            </button>
          </span>
          <span className="flex w-full items-baseline gap-2 md:w-auto">
            <span className="w-16 shrink-0 text-sm text-muted-foreground md:w-auto">
              받은 금액
            </span>
            <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
              {krw.format(received)}원
            </span>
          </span>
          <span className="flex w-full items-baseline gap-2 md:w-auto">
            <span className="w-16 shrink-0 text-sm text-muted-foreground md:w-auto">
              수지
            </span>
            <span className="text-xl font-bold">
              {received - given >= 0 ? "+" : ""}
              {krw.format(received - given)}원
            </span>
          </span>
          <button
            type="button"
            onClick={() => setThisYearOnly((v) => !v)}
            className={cn(
              "ml-auto hidden rounded-full border px-2.5 py-1 text-xs font-medium md:inline-flex",
              thisYearOnly
                ? "border-primary bg-primary/10"
                : "bg-card text-muted-foreground hover:bg-muted",
            )}
          >
            올해만
          </button>
        </CardContent>
      </Card>

      {/* ---------- 탭 + 검색 ---------- */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="grid grid-cols-2 gap-1 rounded-lg border bg-card p-1">
          {(
            [
              { key: "contacts", label: "관계인" },
              { key: "records", label: "최근 기록" },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                tab === t.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="relative min-w-40 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="이름·소속 검색"
            className="h-9 pl-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {tab === "contacts" && (
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setRelationFilter(null)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs font-medium",
              relationFilter === null
                ? "border-primary bg-primary/10"
                : "bg-card text-muted-foreground hover:bg-muted",
            )}
          >
            전체
          </button>
          {GIFT_RELATIONS.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() =>
                setRelationFilter((prev) => (prev === r.key ? null : r.key))
              }
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs font-medium",
                relationFilter === r.key
                  ? "border-primary bg-primary/10"
                  : "bg-card text-muted-foreground hover:bg-muted",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      )}

      {/* ---------- 본문 ---------- */}
      {tab === "contacts" ? (
        filteredContacts.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Gift className="h-7 w-7" />
              </span>
              <div>
                <p className="font-semibold">
                  {query || relationFilter ? "검색 결과가 없어요" : "아직 관계인이 없어요"}
                </p>
                <p className="text-sm text-muted-foreground">
                  경조사를 주고받는 지인을 등록하고 기록을 남겨 보세요.
                </p>
              </div>
              {canEdit && !query && (
                <Button onClick={() => openRecordCreate()}>
                  <Plus />첫 기록 남기기
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {filteredContacts.map((contact) => {
              const relation = GIFT_RELATION_MAP[contact.relation];
              const stat = statsByContact.get(contact.id);
              const owner = contact.owner_user_id
                ? memberById.get(contact.owner_user_id)
                : null;
              return (
                <button
                  key={contact.id}
                  type="button"
                  onClick={() => setDetailContactId(contact.id)}
                  className="rounded-xl border bg-card p-3.5 text-left shadow-sm transition-colors hover:border-primary/40 hover:bg-muted/40"
                >
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold">
                      {contact.name}
                    </span>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                        relation.badge,
                      )}
                    >
                      {relation.label}
                    </span>
                    {owner ? (
                      <span className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: owner.color }}
                        />
                        {owner.display_name}
                      </span>
                    ) : (
                      <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        공통
                      </span>
                    )}
                  </div>
                  {contact.organization && (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {contact.organization}
                    </p>
                  )}
                  <div className="mt-2 flex items-baseline justify-between text-xs">
                    <span>
                      <span className="text-primary">
                        보냄 {krw.format(stat?.given ?? 0)}
                      </span>
                      <span className="text-muted-foreground"> · </span>
                      <span className="text-blue-600 dark:text-blue-400">
                        받음 {krw.format(stat?.received ?? 0)}
                      </span>
                    </span>
                    <span className="text-muted-foreground">
                      {stat?.last ? stat.last.replaceAll("-", ".") : "기록 없음"}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )
      ) : filteredRecords.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            기록이 없어요.
          </CardContent>
        </Card>
      ) : (
        <div className="divide-y rounded-xl border bg-card">
          {filteredRecords.map((record) => (
            <RecordRow key={record.id} record={record} showName />
          ))}
        </div>
      )}

      {/* ---------- 관계인 상세 모달 ---------- */}
      <Modal
        open={detailContact !== null}
        onClose={() => setDetailContactId(null)}
        title={detailContact?.name ?? ""}
        widthClass="sm:max-w-lg"
      >
        {detailContact && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-medium",
                  GIFT_RELATION_MAP[detailContact.relation].badge,
                )}
              >
                {GIFT_RELATION_MAP[detailContact.relation].label}
              </span>
              {detailContact.organization && (
                <span className="text-muted-foreground">
                  {detailContact.organization}
                </span>
              )}
              {detailContact.memo && (
                <span className="text-muted-foreground">· {detailContact.memo}</span>
              )}
            </div>

            {(() => {
              const g = detailRecords
                .filter((r) => r.direction === "given")
                .reduce((s, r) => s + Number(r.amount), 0);
              const rc = detailRecords
                .filter((r) => r.direction === "received")
                .reduce((s, r) => s + Number(r.amount), 0);
              return (
                <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm">
                  <span className="text-primary">보냄 {krw.format(g)}원</span>
                  <span className="text-muted-foreground"> · </span>
                  <span className="text-blue-600 dark:text-blue-400">
                    받음 {krw.format(rc)}원
                  </span>
                  <span className="text-muted-foreground"> · 수지 </span>
                  <span className="font-semibold">
                    {rc - g >= 0 ? "+" : ""}
                    {krw.format(rc - g)}원
                  </span>
                </div>
              );
            })()}

            {detailRecords.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                아직 기록이 없어요.
              </p>
            ) : (
              <div className="divide-y rounded-lg border">
                {detailRecords.map((record) => (
                  <RecordRow key={record.id} record={record} showName={false} />
                ))}
              </div>
            )}

            {canEdit && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setEditingContact(detailContact);
                    setContactModalOpen(true);
                  }}
                >
                  관계인 수정
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => {
                    setEditingRecord(null);
                    setRecordModalOpen(true);
                  }}
                >
                  <Plus />
                  기록 추가
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>

      <GiftRecordFormModal
        open={recordModalOpen}
        onClose={() => setRecordModalOpen(false)}
        familyId={familyId}
        contacts={contacts}
        editing={editingRecord}
        fixedContactId={detailContactId ?? undefined}
      />

      <ContactFormModal
        open={contactModalOpen}
        onClose={() => setContactModalOpen(false)}
        familyId={familyId}
        members={members}
        editing={editingContact}
        recordCount={
          editingContact
            ? records.filter((r) => r.contact_id === editingContact.id).length
            : 0
        }
      />
    </div>
  );
}
