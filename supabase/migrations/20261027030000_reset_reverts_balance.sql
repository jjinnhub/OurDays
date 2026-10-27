-- 가계부 초기화 시 자산 잔액도 함께 역산되도록 변경.
-- (기존: 기록만 삭제하고 잔액 유지 → 변경: 삭제 트리거가 거래별로 잔액을 되돌림)
-- 적용 방법: Supabase 대시보드 > SQL Editor (postgres 역할) 에서 Run

create or replace function public.reset_family_ledger(p_family_id uuid)
returns int
language plpgsql security definer set search_path = public
as $$
declare
  v_count int;
begin
  if not public.can_edit_module(p_family_id, 'ledger') then
    raise exception 'FORBIDDEN';
  end if;

  -- skip 스위치를 켜지 않으므로 삭제 트리거가 각 거래의 잔액 반영분을 역산한다
  delete from public.transactions
  where family_id = p_family_id and not is_private;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.reset_personal_ledger(p_family_id uuid)
returns int
language plpgsql security definer set search_path = public
as $$
declare
  v_count int;
begin
  if not public.is_family_member(p_family_id) then
    raise exception 'FORBIDDEN';
  end if;

  delete from public.transactions
  where family_id = p_family_id
    and is_private
    and created_by = auth.uid();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
