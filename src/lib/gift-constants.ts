/** 관계 분류 */
export const GIFT_RELATIONS = [
  { key: "family", label: "가족", badge: "bg-rose-100 text-rose-700" },
  { key: "relative", label: "친척", badge: "bg-orange-100 text-orange-700" },
  { key: "friend", label: "친구", badge: "bg-sky-100 text-sky-700" },
  { key: "work", label: "직장", badge: "bg-violet-100 text-violet-700" },
  { key: "neighbor", label: "이웃", badge: "bg-emerald-100 text-emerald-700" },
  { key: "etc", label: "기타", badge: "bg-neutral-200 text-neutral-600" },
] as const;

export type GiftRelationKey = (typeof GIFT_RELATIONS)[number]["key"];

export const GIFT_RELATION_MAP = Object.fromEntries(
  GIFT_RELATIONS.map((r) => [r.key, r]),
) as Record<GiftRelationKey, (typeof GIFT_RELATIONS)[number]>;

/** 경조사 유형 */
export const GIFT_EVENT_TYPES = [
  { key: "wedding", label: "결혼", icon: "💍" },
  { key: "funeral", label: "장례", icon: "🕊️" },
  { key: "first_birthday", label: "돌", icon: "🎂" },
  { key: "birthday", label: "생일", icon: "🎉" },
  { key: "opening", label: "개업", icon: "🎊" },
  { key: "holiday", label: "명절", icon: "🧧" },
  { key: "etc", label: "기타", icon: "📌" },
] as const;

export type GiftEventTypeKey = (typeof GIFT_EVENT_TYPES)[number]["key"];

export const GIFT_EVENT_TYPE_MAP = Object.fromEntries(
  GIFT_EVENT_TYPES.map((t) => [t.key, t]),
) as Record<GiftEventTypeKey, (typeof GIFT_EVENT_TYPES)[number]>;

export type Contact = {
  id: string;
  name: string;
  relation: GiftRelationKey;
  organization: string;
  owner_user_id: string | null;
  memo: string;
};

export type GiftRecord = {
  id: string;
  contact_id: string;
  event_type: GiftEventTypeKey;
  direction: "given" | "received";
  amount: number | string;
  occurred_on: string;
  attended: boolean;
  memo: string;
};
