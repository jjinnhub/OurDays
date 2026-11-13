-- 다른 구성원의 개인 자산 → 내 개인 자산 이체를 받는 사람의 개인 가계부에 노출.
-- 내 잔액이 늘어난 사유이므로 받는 사람에게 전체 필드를 공개한다.
-- 수정·삭제는 여전히 보낸 사람의 개인 가계부에서만 가능(읽기 전용 행).
-- 적용 방법: Supabase 대시보드 > SQL Editor (postgres 역할) 에서 Run

create or replace function public.list_private_inbound_transfers(p_family_id uuid)
returns table (
  id uuid,
  title text,
  memo text,
  amount numeric,
  occurred_on date,
  member_user_id uuid,
  from_asset_id uuid,
  to_asset_id uuid
)
language sql security definer stable set search_path = public
as $$
  select
    t.id,
    t.title,
    t.memo,
    t.amount,
    t.occurred_on,
    coalesce(t.member_user_id, t.created_by) as member_user_id,
    t.asset_id as from_asset_id,
    t.to_asset_id
  from public.transactions t
  where t.family_id = p_family_id
    and t.is_private
    and t.type = 'transfer'
    and t.deleted_at is null
    and t.created_by <> auth.uid()
    and public.is_family_member(p_family_id)
    and exists (
      select 1 from public.assets a
      where a.id = t.to_asset_id
        and a.family_id = p_family_id
        and a.is_private
        and a.owner_user_id = auth.uid()
    )
  order by t.occurred_on
$$;

grant execute on function public.list_private_inbound_transfers(uuid) to authenticated;
