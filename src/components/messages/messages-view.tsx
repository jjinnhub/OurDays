"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  NotebookPen,
  Users,
  Pencil,
  SendHorizontal,
  Trash2,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import type { FamilyMemberLite } from "@/lib/asset-constants";
import { pairKey, type Message, type MessageRead } from "@/lib/message-constants";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Props = {
  familyId: string;
  familyName: string;
  currentUserId: string;
  members: FamilyMemberLite[];
  initialMessages: Message[];
  initialReads: MessageRead[];
};

function timeLabel(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function dateLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

export function MessagesView({
  familyId,
  familyName,
  currentUserId,
  members,
  initialMessages,
  initialReads,
}: Props) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [reads, setReads] = useState<Map<string, string>>(
    () => new Map(initialReads.map((r) => [r.peer_id, r.last_read_at])),
  );
  const [selectedPeer, setSelectedPeer] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [actionMessageId, setActionMessageId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const selectedPeerRef = useRef<string | null>(null);
  selectedPeerRef.current = selectedPeer;

  const memberById = useMemo(
    () => new Map(members.map((m) => [m.user_id, m])),
    [members],
  );

  // ---------- Realtime 구독 ----------
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`messages-${familyId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `family_id=eq.${familyId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const msg = payload.new as Message;
            setMessages((prev) =>
              prev.some((m) => m.id === msg.id) ? prev : [...prev, msg],
            );
            // 열려 있는 대화면 바로 읽음 처리
            const peer = pairKey(currentUserId, msg, familyId);
            if (selectedPeerRef.current === peer) {
              void markRead(peer);
            }
          } else if (payload.eventType === "UPDATE") {
            const msg = payload.new as Message;
            setMessages((prev) => prev.map((m) => (m.id === msg.id ? msg : m)));
          } else if (payload.eventType === "DELETE") {
            const old = payload.old as Partial<Message>;
            setMessages((prev) => prev.filter((m) => m.id !== old.id));
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familyId, currentUserId]);

  async function markRead(peerId: string) {
    const now = new Date().toISOString();
    setReads((prev) => new Map(prev).set(peerId, now));
    const supabase = createClient();
    await supabase.from("message_reads").upsert({
      user_id: currentUserId,
      family_id: familyId,
      peer_id: peerId,
      last_read_at: now,
    });
  }

  // ---------- 대화 목록 데이터 ----------
  const conversations = useMemo(() => {
    const lastByPeer = new Map<string, Message>();
    const unreadByPeer = new Map<string, number>();
    for (const msg of messages) {
      const peer = pairKey(currentUserId, msg, familyId);
      const last = lastByPeer.get(peer);
      if (!last || msg.created_at > last.created_at) lastByPeer.set(peer, msg);
      if (msg.sender_id !== currentUserId) {
        const readAt = reads.get(peer) ?? "";
        if (msg.created_at > readAt) {
          unreadByPeer.set(peer, (unreadByPeer.get(peer) ?? 0) + 1);
        }
      }
    }
    const others = members
      .filter((m) => m.user_id !== currentUserId)
      .map((m) => ({
        peerId: m.user_id,
        member: m,
        last: lastByPeer.get(m.user_id) ?? null,
        unread: unreadByPeer.get(m.user_id) ?? 0,
      }))
      .sort((a, b) =>
        (b.last?.created_at ?? "").localeCompare(a.last?.created_at ?? ""),
      );
    return {
      memo: {
        peerId: currentUserId,
        last: lastByPeer.get(currentUserId) ?? null,
      },
      familyRoom: {
        peerId: familyId,
        last: lastByPeer.get(familyId) ?? null,
        unread: unreadByPeer.get(familyId) ?? 0,
      },
      others,
    };
  }, [messages, members, currentUserId, reads, familyId]);

  const thread = useMemo(() => {
    if (!selectedPeer) return [];
    return messages
      .filter((m) => pairKey(currentUserId, m, familyId) === selectedPeer)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
  }, [messages, selectedPeer, currentUserId, familyId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [thread.length, selectedPeer]);

  function openConversation(peerId: string) {
    setSelectedPeer(peerId);
    setActionMessageId(null);
    setEditingId(null);
    setError(null);
    void markRead(peerId);
  }

  async function send() {
    const content = draft.trim();
    if (!content || !selectedPeer || sending) return;
    setSending(true);
    setError(null);
    const supabase = createClient();
    const { data, error: dbError } = await supabase
      .from("messages")
      .insert({
        family_id: familyId,
        sender_id: currentUserId,
        recipient_id: selectedPeer === familyId ? null : selectedPeer,
        content,
      })
      .select("*")
      .single();
    setSending(false);
    if (dbError) {
      setError(dbError.message);
      return;
    }
    setDraft("");
    if (data) {
      const msg = data as Message;
      setMessages((prev) =>
        prev.some((m) => m.id === msg.id) ? prev : [...prev, msg],
      );
    }
  }

  async function saveEdit(message: Message) {
    const content = editDraft.trim();
    if (!content) return;
    const supabase = createClient();
    const { error: dbError } = await supabase
      .from("messages")
      .update({ content, edited: true })
      .eq("id", message.id);
    if (dbError) {
      setError(dbError.message);
      return;
    }
    setMessages((prev) =>
      prev.map((m) => (m.id === message.id ? { ...m, content, edited: true } : m)),
    );
    setEditingId(null);
    setActionMessageId(null);
  }

  async function remove(message: Message) {
    const supabase = createClient();
    const { error: dbError } = await supabase
      .from("messages")
      .delete()
      .eq("id", message.id);
    if (dbError) {
      setError(dbError.message);
      return;
    }
    setMessages((prev) => prev.filter((m) => m.id !== message.id));
    setActionMessageId(null);
  }

  const selectedMember = selectedPeer ? memberById.get(selectedPeer) : null;
  const isMemo = selectedPeer === currentUserId;
  const isGroup = selectedPeer === familyId;

  // ---------- 렌더 ----------
  function Avatar({ userId, size = 9 }: { userId: string; size?: 8 | 9 }) {
    const m = memberById.get(userId);
    return (
      <span
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full font-semibold text-white",
          size === 9 ? "h-9 w-9 text-sm" : "h-8 w-8 text-xs",
        )}
        style={{ backgroundColor: m?.color ?? "#878787" }}
      >
        {(m?.display_name ?? "?").slice(0, 1)}
      </span>
    );
  }

  const listPane = (
    <div
      className={cn(
        "flex w-full flex-col rounded-xl border bg-card md:w-72 md:shrink-0",
        selectedPeer !== null && "hidden md:flex",
      )}
    >
      <div className="border-b px-4 py-3">
        <h2 className="text-sm font-semibold">메시지</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {/* 나에게 (메모) */}
        <button
          type="button"
          onClick={() => openConversation(currentUserId)}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left",
            selectedPeer === currentUserId ? "bg-primary/10" : "hover:bg-muted",
          )}
        >
          <span className="relative">
            <Avatar userId={currentUserId} />
            <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-card">
              <NotebookPen className="h-3 w-3 text-muted-foreground" />
            </span>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium">나에게 (메모)</span>
            <span className="block truncate text-xs text-muted-foreground">
              {conversations.memo.last?.content ?? "나만 볼 수 있는 메모 공간"}
            </span>
          </span>
        </button>

        <div className="my-1.5 h-px bg-border" />

        {/* 가족 전체 대화방 */}
        <button
          type="button"
          onClick={() => openConversation(familyId)}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left",
            selectedPeer === familyId ? "bg-primary/10" : "hover:bg-muted",
          )}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Users className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium">{familyName}</span>
            <span className="block truncate text-xs text-muted-foreground">
              {conversations.familyRoom.last?.content ?? "가족 모두가 함께하는 대화방"}
            </span>
          </span>
          {conversations.familyRoom.unread > 0 && (
            <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground">
              {conversations.familyRoom.unread > 99
                ? "99+"
                : conversations.familyRoom.unread}
            </span>
          )}
        </button>

        {conversations.others.length === 0 && (
          <p className="px-2.5 py-3 text-xs text-muted-foreground">
            아직 함께하는 가족이 없어요. 초대코드로 가족을 초대해 보세요.
          </p>
        )}
        {conversations.others.map(({ peerId, member, last, unread }) => (
          <button
            key={peerId}
            type="button"
            onClick={() => openConversation(peerId)}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left",
              selectedPeer === peerId ? "bg-primary/10" : "hover:bg-muted",
            )}
          >
            <Avatar userId={peerId} />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">{member.display_name}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {last?.content ?? "대화를 시작해 보세요"}
              </span>
            </span>
            {unread > 0 && (
              <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground">
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );

  const conversationPane = selectedPeer ? (
    <div className="flex min-h-0 flex-1 flex-col rounded-xl border bg-card">
      {/* 헤더 */}
      <div className="flex items-center gap-2.5 border-b px-4 py-3">
        <button
          type="button"
          onClick={() => setSelectedPeer(null)}
          aria-label="목록으로"
          className="rounded-md p-1 text-muted-foreground hover:bg-muted md:hidden"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        {isGroup ? (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Users className="h-4 w-4" />
          </span>
        ) : (
          <Avatar userId={selectedPeer} size={8} />
        )}
        <div>
          <p className="text-sm font-semibold">
            {isGroup
              ? familyName
              : isMemo
                ? "나에게 (메모)"
                : (selectedMember?.display_name ?? "대화")}
          </p>
          <p className="text-xs text-muted-foreground">
            {isGroup
              ? "가족 모두가 함께하는 대화방"
              : isMemo
                ? "나만 볼 수 있는 공간 · 메모를 자유롭게 보관하세요"
                : "가족에게만 보이는 1:1 대화"}
          </p>
        </div>
      </div>

      {/* 메시지 목록 */}
      <div className="flex-1 space-y-1 overflow-y-auto px-4 py-3">
        {thread.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {isGroup
              ? "가족 모두에게 전할 이야기를 남겨 보세요 🏡"
              : isMemo
                ? "첫 메모를 남겨 보세요. 링크, 할 일, 아이디어 뭐든 좋아요."
                : "아직 주고받은 메시지가 없어요. 먼저 인사를 건네 보세요 👋"}
          </p>
        )}
        {thread.map((message, i) => {
          const prev = thread[i - 1];
          const newDay =
            !prev ||
            new Date(prev.created_at).toDateString() !==
              new Date(message.created_at).toDateString();
          const mine = message.sender_id === currentUserId;
          const sender = memberById.get(message.sender_id);
          const showActions = actionMessageId === message.id && mine;
          const isEditing = editingId === message.id;

          return (
            <div key={message.id}>
              {newDay && (
                <div className="flex items-center gap-3 py-3">
                  <span className="h-px flex-1 bg-border" />
                  <span className="text-xs text-muted-foreground">
                    {dateLabel(message.created_at)}
                  </span>
                  <span className="h-px flex-1 bg-border" />
                </div>
              )}
              <div
                className={cn(
                  "group flex gap-2.5 rounded-lg px-2 py-1.5",
                  mine && "cursor-pointer hover:bg-muted/40",
                )}
                onClick={() => {
                  if (mine && !isEditing)
                    setActionMessageId((v) => (v === message.id ? null : message.id));
                }}
              >
                <Avatar userId={message.sender_id} size={8} />
                <div className="min-w-0 flex-1">
                  <p className="flex items-baseline gap-2 text-sm">
                    <span className="font-semibold">
                      {sender?.display_name ?? "알 수 없음"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {timeLabel(message.created_at)}
                    </span>
                    {message.edited && (
                      <span className="text-xs text-muted-foreground">(수정됨)</span>
                    )}
                  </p>
                  {isEditing ? (
                    <div
                      className="mt-1 space-y-1.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <textarea
                        value={editDraft}
                        onChange={(e) => setEditDraft(e.target.value)}
                        rows={2}
                        className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                      <div className="flex gap-1.5">
                        <Button size="sm" className="h-7" onClick={() => saveEdit(message)}>
                          <Check />
                          저장
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7"
                          onClick={() => setEditingId(null)}
                        >
                          <X />
                          취소
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap break-words text-sm">
                      {message.content}
                    </p>
                  )}
                  {showActions && !isEditing && (
                    <div
                      className="mt-1 flex gap-1.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7"
                        onClick={() => {
                          setEditingId(message.id);
                          setEditDraft(message.content);
                        }}
                      >
                        <Pencil />
                        수정
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => remove(message)}
                      >
                        <Trash2 />
                        삭제
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* 입력창 */}
      <div className="border-t p-3">
        {error && <p className="pb-2 text-xs text-destructive">{error}</p>}
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void send();
              }
            }}
            placeholder={
              isMemo
                ? "메모를 입력하세요...\n(Enter: 저장, Shift+Enter: 줄바꿈)"
                : "메시지를 입력하세요...\n(Enter: 전송, Shift+Enter: 줄바꿈)"
            }
            rows={2}
            className="flex-1 resize-none rounded-md border border-input bg-card px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <Button
            size="icon"
            className="h-10 w-10 shrink-0"
            disabled={!draft.trim() || sending}
            onClick={send}
            aria-label="전송"
          >
            <SendHorizontal />
          </Button>
        </div>
      </div>
    </div>
  ) : (
    <div className="hidden min-h-0 flex-1 items-center justify-center rounded-xl border bg-card md:flex">
      <div className="text-center text-sm text-muted-foreground">
        <p className="font-medium text-foreground">대화를 선택하세요</p>
        <p className="mt-1">
          나에게 보내면 메모장처럼, 가족에게 보내면 채팅처럼 쓸 수 있어요.
        </p>
      </div>
    </div>
  );

  return (
    <div className="flex h-[calc(100dvh-10.5rem)] min-h-96 gap-3 md:h-[calc(100dvh-8rem)]">
      {listPane}
      {conversationPane}
    </div>
  );
}
