-- OurDays: 장바구니 (가족 공유 쇼핑 리스트 + 체크리스트 항목)
-- 적용 방법: Supabase 대시보드 > SQL Editor (postgres 역할) 에서 Run

-- 권한 모듈에 'shopping' 추가 (구성원 권한 토글 대상)
alter table public.member_permissions
  drop constraint if exists member_permissions_module_check;
alter table public.member_permissions
  add constraint member_permissions_module_check check (module in (
    'assets', 'ledger', 'fixed_costs', 'calendar', 'trips', 'gifts', 'files',
    'shopping'
  ));

-- 리스트 (다이소, 롯데마트, 식재료 ...)
create table if not exists public.shopping_lists (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 30),
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists shopping_lists_family_idx
  on public.shopping_lists (family_id, created_at);

-- 항목 (이름 · 수량 자유 텍스트 · 메모 · 추가자 · 체크자)
create table if not exists public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.shopping_lists(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 50),
  quantity text not null default '' check (char_length(quantity) <= 20),
  memo text not null default '' check (char_length(memo) <= 100),
  created_by uuid not null default auth.uid(),
  checked_by uuid,
  checked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists shopping_items_list_idx
  on public.shopping_items (list_id, created_at);
create index if not exists shopping_items_family_idx
  on public.shopping_items (family_id);

alter table public.shopping_lists enable row level security;
alter table public.shopping_items enable row level security;

-- 조회: 가족 구성원 전체 / 쓰기: 모듈 권한('shopping') 보유자만
drop policy if exists "shopping_lists: family read" on public.shopping_lists;
create policy "shopping_lists: family read" on public.shopping_lists for select
  using (public.is_family_member(family_id));

drop policy if exists "shopping_lists: editor insert" on public.shopping_lists;
create policy "shopping_lists: editor insert" on public.shopping_lists for insert
  with check (
    created_by = auth.uid() and public.can_edit_module(family_id, 'shopping')
  );

drop policy if exists "shopping_lists: editor update" on public.shopping_lists;
create policy "shopping_lists: editor update" on public.shopping_lists for update
  using (public.can_edit_module(family_id, 'shopping'))
  with check (public.can_edit_module(family_id, 'shopping'));

drop policy if exists "shopping_lists: editor delete" on public.shopping_lists;
create policy "shopping_lists: editor delete" on public.shopping_lists for delete
  using (public.can_edit_module(family_id, 'shopping'));

drop policy if exists "shopping_items: family read" on public.shopping_items;
create policy "shopping_items: family read" on public.shopping_items for select
  using (public.is_family_member(family_id));

drop policy if exists "shopping_items: editor insert" on public.shopping_items;
create policy "shopping_items: editor insert" on public.shopping_items for insert
  with check (
    created_by = auth.uid()
    and public.can_edit_module(family_id, 'shopping')
    and exists (
      select 1 from public.shopping_lists l
      where l.id = list_id and l.family_id = shopping_items.family_id
    )
  );

drop policy if exists "shopping_items: editor update" on public.shopping_items;
create policy "shopping_items: editor update" on public.shopping_items for update
  using (public.can_edit_module(family_id, 'shopping'))
  with check (public.can_edit_module(family_id, 'shopping'));

drop policy if exists "shopping_items: editor delete" on public.shopping_items;
create policy "shopping_items: editor delete" on public.shopping_items for delete
  using (public.can_edit_module(family_id, 'shopping'));

-- Realtime: 삭제 이벤트에도 전체 행이 실리도록 하고, 발행 목록에 추가
alter table public.shopping_lists replica identity full;
alter table public.shopping_items replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.shopping_lists;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.shopping_items;
exception
  when duplicate_object then null;
end $$;
