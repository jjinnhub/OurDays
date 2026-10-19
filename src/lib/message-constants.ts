export type Message = {
  id: string;
  sender_id: string;
  recipient_id: string | null; // null = 가족 전체방
  content: string;
  edited: boolean;
  created_at: string;
};

export type MessageRead = {
  peer_id: string;
  last_read_at: string;
};

/** 대화방 키 — 전체방은 familyId, 1:1은 상대방 id, 메모는 내 id */
export function pairKey(me: string, message: Message, familyId: string): string {
  if (message.recipient_id === null) return familyId;
  return message.sender_id === me ? message.recipient_id : message.sender_id;
}
