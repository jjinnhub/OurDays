-- OurDays: 할 일 (가족 공통/구성원별 할 일 + 기한·중요·비공개)
-- 적용 방법: Supabase 대시보드 > SQL Editor (postgres 역할) 에서 Run

-- 권한 모듈에 'todos' 추가 (구성원 권한 토글 대상)
alter table public.member_permissions
  drop constraint if exists member_permissions_module_check;
alter table public.member_permissions
  add constraint member_permissions_module_check check (module in (
    'assets', 'ledger', 'fixed_costs', 'calendar', 'trips', 'gifts', 'files',
    'shopping', 'meals', 'places', 'todos'
  ));

create table if not exists public.todos (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 100),
  memo text not null default '' check (char_length(memo) <= 200),
  assignee_user_id uuid, -- null = 가족 공통
  due_on date,
  is_important boolean not null default false,
  is_private boolean not null default false,
  created_by uuid not null default auth.uid(),
  done_by uuid,
  done_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists todos_family_idx
  on public.todos (family_id, due_on, created_at);

alter table public.todos enable row level security;

-- 조회: 가족 구성원 전체, 단 비공개는 본인 것만
drop policy if exists "todos: family read" on public.todos;
create policy "todos: family read" on public.todos for select
  using (
    public.is_family_member(family_id)
    and (not is_private or created_by = auth.uid())
  );

-- 쓰기: 모듈 권한('todos') 보유자, 비공개는 본인 것만
drop policy if exists "todos: editor insert" on public.todos;
create policy "todos: editor insert" on public.todos for insert
  with check (
    created_by = auth.uid() and public.can_edit_module(family_id, 'todos')
  );

drop policy if exists "todos: editor update" on public.todos;
create policy "todos: editor update" on public.todos for update
  using (
    public.can_edit_module(family_id, 'todos')
    and (not is_private or created_by = auth.uid())
  )
  with check (
    public.can_edit_module(family_id, 'todos')
    and (not is_private or created_by = auth.uid())
  );

drop policy if exists "todos: editor delete" on public.todos;
create policy "todos: editor delete" on public.todos for delete
  using (
    public.can_edit_module(family_id, 'todos')
    and (not is_private or created_by = auth.uid())
  );

-- Realtime: 삭제 이벤트에도 전체 행이 실리도록 하고, 발행 목록에 추가
alter table public.todos replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.todos;
exception
  when duplicate_object then null;
end $$;
