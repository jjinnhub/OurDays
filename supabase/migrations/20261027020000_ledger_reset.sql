-- 가계부 초기화: 거래 기록만 삭제하고 자산 잔액은 유지한다.
-- 가족 초기화 = 가계부 편집 권한자(owner/admin + 대표가 켜준 member),
-- 개인 초기화 = 본인 개인 기록만, 누구나.
-- 적용 방법: Supabase 대시보드 > SQL Editor (postgres 역할) 에서 Run

-- 1) 잔액 동기화 트리거에 '건너뛰기' 스위치 추가 (초기화 중에만 사용)
create or replace function public.handle_tx_change()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if current_setting('ourdays.skip_balance', true) = '1' then
    return null; -- 초기화: 기록만 지우고 잔액은 그대로
  end if;

  if tg_op = 'INSERT' then
    if new.deleted_at is null then
      perform public.tx_apply(new, false);
    end if;
    return null;
  elsif tg_op = 'UPDATE' then
    if old.deleted_at is null then
      perform public.tx_apply(old, true);
    end if;
    if new.deleted_at is null then
      perform public.tx_apply(new, false);
    end if;
    return null;
  elsif tg_op = 'DELETE' then
    if old.deleted_at is null then
      perform public.tx_apply(old, true);
    end if;
    return null;
  end if;
  return null;
end;
$$;

-- 2) 가족 가계부 초기화 (공동 기록만 — 구성원 개인 기록은 건드리지 않음)
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

  perform set_config('ourdays.skip_balance', '1', true);
  delete from public.transactions
  where family_id = p_family_id and not is_private;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- 3) 개인 가계부 초기화 (본인 기록만)
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

  perform set_config('ourdays.skip_balance', '1', true);
  delete from public.transactions
  where family_id = p_family_id
    and is_private
    and created_by = auth.uid();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function
  public.reset_family_ledger(uuid),
  public.reset_personal_ledger(uuid)
to authenticated;
