/** 여기어때 — 장소 상태 (마커 색으로 구분) */
export const PLACE_STATUSES = [
  { key: "wish", label: "가보고 싶어요", color: "#E8A13D" },
  { key: "liked", label: "또 가고 싶어요", color: "#4A90D9" },
  { key: "disliked", label: "별로였어요", color: "#9A938C" },
] as const;

export type PlaceStatusKey = (typeof PLACE_STATUSES)[number]["key"];

export const PLACE_STATUS_MAP = Object.fromEntries(
  PLACE_STATUSES.map((s) => [s.key, s]),
) as Record<PlaceStatusKey, (typeof PLACE_STATUSES)[number]>;

export type PlaceCategory = {
  id: string;
  family_id: string;
  name: string;
  icon: string;
  sort_order: number;
  created_at: string;
};

export type Place = {
  id: string;
  family_id: string;
  category_id: string | null;
  name: string;
  address: string;
  lat: number;
  lng: number;
  status: PlaceStatusKey;
  memo: string;
  kakao_place_id: string;
  kakao_url: string;
  created_by: string;
  created_at: string;
};

/** 카카오 키워드 검색 결과 중 사용하는 필드 */
export type KakaoSearchResult = {
  id: string;
  place_name: string;
  address_name: string;
  road_address_name: string;
  x: string; // 경도
  y: string; // 위도
  category_group_code: string;
  place_url: string;
};

/** 카카오 카테고리 그룹 코드 → 기본 카테고리명 매핑 (이름이 일치하는 카테고리가 있을 때만 자동 선택) */
export const KAKAO_GROUP_TO_CATEGORY: Record<string, string> = {
  FD6: "맛집",
  CE7: "카페",
  AT4: "관광지",
};

/** 장소가 없을 때 지도 기본 중심 (서울시청) */
export const DEFAULT_CENTER = { lat: 37.5665, lng: 126.978 };

/** 카카오맵 길찾기 링크 */
export function kakaoDirectionsUrl(name: string, lat: number, lng: number) {
  return `https://map.kakao.com/link/to/${encodeURIComponent(name)},${lat},${lng}`;
}
