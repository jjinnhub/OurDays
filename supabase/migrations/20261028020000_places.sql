-- OurDays: 여기어때 (가족 장소 공유 지도 — 위시/좋았던 곳/별로였던 곳)
-- 적용 방법: Supabase 대시보드 > SQL Editor (postgres 역할) 에서 Run

-- 권한 모듈에 'places' 추가 (구성원 권한 토글 대상)
alter table public.member_permissions
  drop constraint if exists member_permissions_module_check;
alter table public.member_permissions
  add constraint member_permissions_module_check check (module in (
    'assets', 'ledger', 'fixed_costs', 'calendar', 'trips', 'gifts', 'files',
    'shopping', 'meals', 'places'
  ));

-- 장소 카테고리 (맛집, 카페, 관광지 ... 이모지 아이콘 포함)
create table if not exists public.place_categories (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 20),
  icon text not null default '📍' check (char_length(icon) between 1 and 8),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists place_categories_family_idx
  on public.place_categories (family_id, sort_order, created_at);

-- 장소 — 카카오 장소 검색으로 등록, 상태(가보고 싶어요/또 가고 싶어요/별로였어요)
create table if not exists public.places (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  category_id uuid references public.place_categories(id) on delete set null,
  name text not null check (char_length(name) between 1 and 100),
  address text not null default '',
  lat double precision not null,
  lng double precision not null,
  status text not null default 'wish' check (status in ('wish', 'liked', 'disliked')),
  memo text not null default '' check (char_length(memo) <= 200),
  kakao_place_id text not null default '',
  kakao_url text not null default '',
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists places_family_idx
  on public.places (family_id, created_at);

alter table public.place_categories enable row level security;
alter table public.places enable row level security;

-- 조회: 가족 구성원 전체 / 쓰기: 모듈 권한('places') 보유자만
drop policy if exists "place_categories: family read" on public.place_categories;
create policy "place_categories: family read" on public.place_categories for select
  using (public.is_family_member(family_id));

drop policy if exists "place_categories: editor insert" on public.place_categories;
create policy "place_categories: editor insert" on public.place_categories for insert
  with check (public.can_edit_module(family_id, 'places'));

drop policy if exists "place_categories: editor update" on public.place_categories;
create policy "place_categories: editor update" on public.place_categories for update
  using (public.can_edit_module(family_id, 'places'))
  with check (public.can_edit_module(family_id, 'places'));

drop policy if exists "place_categories: editor delete" on public.place_categories;
create policy "place_categories: editor delete" on public.place_categories for delete
  using (public.can_edit_module(family_id, 'places'));

drop policy if exists "places: family read" on public.places;
create policy "places: family read" on public.places for select
  using (public.is_family_member(family_id));

drop policy if exists "places: editor insert" on public.places;
create policy "places: editor insert" on public.places for insert
  with check (
    created_by = auth.uid() and public.can_edit_module(family_id, 'places')
  );

drop policy if exists "places: editor update" on public.places;
create policy "places: editor update" on public.places for update
  using (public.can_edit_module(family_id, 'places'))
  with check (public.can_edit_module(family_id, 'places'));

drop policy if exists "places: editor delete" on public.places;
create policy "places: editor delete" on public.places for delete
  using (public.can_edit_module(family_id, 'places'));

-- 기본 카테고리 시드 — 카테고리가 하나도 없을 때만 생성 (첫 진입 시 클라이언트가 호출)
create or replace function public.ensure_place_categories(p_family_id uuid)
returns setof public.place_categories
language plpgsql security definer set search_path = public
as $$
begin
  if not public.can_edit_module(p_family_id, 'places') then
    raise exception 'FORBIDDEN';
  end if;

  if not exists (
    select 1 from public.place_categories where family_id = p_family_id
  ) then
    insert into public.place_categories (family_id, name, icon, sort_order)
    values
      (p_family_id, '맛집', '🍜', 0),
      (p_family_id, '카페', '☕', 1),
      (p_family_id, '관광지', '🏞️', 2),
      (p_family_id, '기타', '📍', 3);
  end if;

  return query
    select * from public.place_categories
    where family_id = p_family_id
    order by sort_order, created_at;
end;
$$;

grant execute on function public.ensure_place_categories(uuid) to authenticated;
