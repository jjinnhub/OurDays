-- OurDays: 식단표 (주간 급식표 + 끼니·카테고리별 메뉴)
-- 적용 방법: Supabase 대시보드 > SQL Editor (postgres 역할) 에서 Run

-- 권한 모듈에 'meals' 추가 (구성원 권한 토글 대상)
alter table public.member_permissions
  drop constraint if exists member_permissions_module_check;
alter table public.member_permissions
  add constraint member_permissions_module_check check (module in (
    'assets', 'ledger', 'fixed_costs', 'calendar', 'trips', 'gifts', 'files',
    'shopping', 'meals'
  ));

-- 메뉴 카테고리 (밥, 국/찌개, 메인 반찬, 밑반찬 ...)
create table if not exists public.meal_categories (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 20),
  color text not null default '#E8645B',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists meal_categories_family_idx
  on public.meal_categories (family_id, sort_order, created_at);

-- 식단 항목 — 날짜 + 끼니(아침/점심/저녁) + 카테고리 + 메뉴명
create table if not exists public.meal_entries (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  category_id uuid references public.meal_categories(id) on delete set null,
  meal_date date not null,
  slot text not null check (slot in ('breakfast', 'lunch', 'dinner')),
  name text not null check (char_length(name) between 1 and 50),
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists meal_entries_family_date_idx
  on public.meal_entries (family_id, meal_date);

alter table public.meal_categories enable row level security;
alter table public.meal_entries enable row level security;

-- 조회: 가족 구성원 전체 / 쓰기: 모듈 권한('meals') 보유자만
drop policy if exists "meal_categories: family read" on public.meal_categories;
create policy "meal_categories: family read" on public.meal_categories for select
  using (public.is_family_member(family_id));

drop policy if exists "meal_categories: editor insert" on public.meal_categories;
create policy "meal_categories: editor insert" on public.meal_categories for insert
  with check (public.can_edit_module(family_id, 'meals'));

drop policy if exists "meal_categories: editor update" on public.meal_categories;
create policy "meal_categories: editor update" on public.meal_categories for update
  using (public.can_edit_module(family_id, 'meals'))
  with check (public.can_edit_module(family_id, 'meals'));

drop policy if exists "meal_categories: editor delete" on public.meal_categories;
create policy "meal_categories: editor delete" on public.meal_categories for delete
  using (public.can_edit_module(family_id, 'meals'));

drop policy if exists "meal_entries: family read" on public.meal_entries;
create policy "meal_entries: family read" on public.meal_entries for select
  using (public.is_family_member(family_id));

drop policy if exists "meal_entries: editor insert" on public.meal_entries;
create policy "meal_entries: editor insert" on public.meal_entries for insert
  with check (
    created_by = auth.uid() and public.can_edit_module(family_id, 'meals')
  );

drop policy if exists "meal_entries: editor update" on public.meal_entries;
create policy "meal_entries: editor update" on public.meal_entries for update
  using (public.can_edit_module(family_id, 'meals'))
  with check (public.can_edit_module(family_id, 'meals'));

drop policy if exists "meal_entries: editor delete" on public.meal_entries;
create policy "meal_entries: editor delete" on public.meal_entries for delete
  using (public.can_edit_module(family_id, 'meals'));

-- 기본 카테고리 시드 — 카테고리가 하나도 없을 때만 생성 (첫 진입 시 클라이언트가 호출)
create or replace function public.ensure_meal_categories(p_family_id uuid)
returns setof public.meal_categories
language plpgsql security definer set search_path = public
as $$
begin
  if not public.can_edit_module(p_family_id, 'meals') then
    raise exception 'FORBIDDEN';
  end if;

  if not exists (
    select 1 from public.meal_categories where family_id = p_family_id
  ) then
    insert into public.meal_categories (family_id, name, color, sort_order)
    values
      (p_family_id, '밥', '#E3B23C', 0),
      (p_family_id, '국/찌개', '#5E8C9E', 1),
      (p_family_id, '메인 반찬', '#E8645B', 2),
      (p_family_id, '밑반찬', '#7BA05B', 3),
      (p_family_id, '간식/후식', '#C76B8E', 4);
  end if;

  return query
    select * from public.meal_categories
    where family_id = p_family_id
    order by sort_order, created_at;
end;
$$;

grant execute on function public.ensure_meal_categories(uuid) to authenticated;

-- Realtime: 삭제 이벤트에도 전체 행이 실리도록 하고, 발행 목록에 추가
alter table public.meal_categories replica identity full;
alter table public.meal_entries replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.meal_categories;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.meal_entries;
exception
  when duplicate_object then null;
end $$;
