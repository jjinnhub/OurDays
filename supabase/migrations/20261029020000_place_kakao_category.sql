-- OurDays: 장소에 카카오 카테고리 라벨 저장
-- (음식점은 세부 분류(중식·한식 등), 카페/관광지는 그룹명으로 등록 시 자동 저장)
-- 적용 방법: Supabase 대시보드 > SQL Editor (postgres 역할) 에서 Run

alter table public.places
  add column if not exists kakao_category text not null default ''
  check (char_length(kakao_category) <= 50);
