-- OurDays: 납부 시 수정한 금액은 가계부 거래에만 반영
-- 월 예산 회차(fixed_cost_occurrences)의 금액은 예산에 등록한 값을 유지한다.
-- 적용 방법: Supabase 대시보드 > SQL Editor (postgres 역할) 에서 Run

create or replace function public.pay_fixed_cost_occurrence(
  p_occurrence_id uuid,
  p_paid_on date default null,
  p_record_tx boolean default false,
  p_category_id uuid default null,
  p_asset_id uuid default null,
  p_memo text default '',
  p_amount numeric default null
)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  occ public.fixed_cost_occurrences%rowtype;
  fc public.fixed_costs%rowtype;
  v_tx_id uuid;
  v_date date;
  v_amount numeric;
  v_from_private boolean := false;
  v_from_owner uuid;
  v_is_private boolean;
  v_member uuid;
begin
  select * into occ from public.fixed_cost_occurrences where id = p_occurrence_id;
  if occ.id is null then
    raise exception 'NOT_FOUND';
  end if;
  if not public.can_edit_module(occ.family_id, 'fixed_costs') then
    raise exception 'FORBIDDEN';
  end if;

  select * into fc from public.fixed_costs where id = occ.fixed_cost_id;
  v_date := coalesce(p_paid_on, occ.due_on);
  v_amount := coalesce(p_amount, occ.amount);
  if v_amount <= 0 then
    raise exception 'INVALID_AMOUNT';
  end if;

  if p_record_tx then
    if p_asset_id is not null then
      select a.is_private, a.owner_user_id
      into v_from_private, v_from_owner
      from public.assets a
      where a.id = p_asset_id;
      if v_from_private and v_from_owner is distinct from auth.uid() then
        raise exception 'PRIVATE_ASSET_FORBIDDEN';
      end if;
    end if;

    v_is_private := fc.is_private or coalesce(v_from_private, false);
    v_member := case
      when v_is_private then auth.uid()
      else fc.member_user_id
    end;

    if fc.tx_type = 'transfer' then
      if p_asset_id is null or fc.asset_id is null then
        raise exception 'TRANSFER_ASSETS_REQUIRED';
      end if;
      if p_asset_id = fc.asset_id then
        raise exception 'TRANSFER_SAME_ASSET';
      end if;
      insert into public.transactions
        (family_id, type, title, amount, occurred_on, category_id,
         asset_id, to_asset_id, member_user_id, memo, is_private, created_by)
      values
        (occ.family_id, 'transfer', fc.name, v_amount, v_date, null,
         p_asset_id, fc.asset_id, v_member, coalesce(p_memo, ''),
         v_is_private, auth.uid())
      returning id into v_tx_id;
    else
      insert into public.transactions
        (family_id, type, title, amount, occurred_on, category_id,
         asset_id, to_asset_id, member_user_id, memo, is_private, created_by)
      values
        (occ.family_id, 'expense', fc.name, v_amount, v_date, p_category_id,
         p_asset_id, null, v_member, coalesce(p_memo, ''),
         v_is_private, auth.uid())
      returning id into v_tx_id;
    end if;
  end if;

  -- 회차 금액은 예산 값 유지 (수정 금액은 가계부 거래에만 반영)
  update public.fixed_cost_occurrences
  set status = 'paid', paid_on = v_date, tx_id = v_tx_id
  where id = p_occurrence_id;
end;
$$;

grant execute on function
  public.pay_fixed_cost_occurrence(uuid, date, boolean, uuid, uuid, text, numeric)
  to authenticated;

-- 해제도 금액은 건드리지 않는 단순 형태로 되돌림
create or replace function public.unpay_fixed_cost_occurrence(p_occurrence_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  occ public.fixed_cost_occurrences%rowtype;
begin
  select * into occ from public.fixed_cost_occurrences where id = p_occurrence_id;
  if occ.id is null then
    raise exception 'NOT_FOUND';
  end if;
  if not public.can_edit_module(occ.family_id, 'fixed_costs') then
    raise exception 'FORBIDDEN';
  end if;

  if occ.tx_id is not null then
    delete from public.transactions where id = occ.tx_id;
  end if;

  update public.fixed_cost_occurrences
  set status = 'pending', paid_on = null, tx_id = null
  where id = p_occurrence_id;
end;
$$;

grant execute on function public.unpay_fixed_cost_occurrence(uuid) to authenticated;

-- 일회성 보정: 납부 시 금액 수정으로 이미 바뀐 회차 금액을 예산 값으로 되돌림
-- (가계부 연동 납부분만 — 실제 납부액은 연결된 가계부 거래에 남아 있음)
update public.fixed_cost_occurrences o
set amount = fc.amount
from public.fixed_costs fc
where o.fixed_cost_id = fc.id
  and o.status = 'paid'
  and o.tx_id is not null
  and o.amount is distinct from fc.amount;
