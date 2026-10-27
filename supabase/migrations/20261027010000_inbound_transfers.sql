-- 개인 → 공동 자산 이체를 가족 집계·표시용으로 노출.
-- 공동 잔액이 늘어난 사유이므로 내용·메모 포함 전체 필드를 가족에게 공개한다(사용자 결정).
-- 수정·삭제는 여전히 작성자 본인의 개인 가계부에서만 가능.
-- 적용 방법: Supabase 대시보드 > SQL Editor (postgres 역할) 에서 Run

create or replace function public.list_shared_inbound_transfers(p_family_id uuid)
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
    and public.is_family_member(p_family_id)
    and exists (
      select 1 from public.assets a
      where a.id = t.to_asset_id
        and a.family_id = p_family_id
        and not a.is_private
    )
  order by t.occurred_on
$$;

grant execute on function public.list_shared_inbound_transfers(uuid) to authenticated;
