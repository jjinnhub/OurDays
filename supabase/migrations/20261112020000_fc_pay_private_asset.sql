-- OurDays: 납부 기록 시 개인 자산 결제 처리 보정
-- 개인 자산이 돈이 나가는 쪽이면 거래를 🔒 개인 거래로 기록해 프라이버시 규칙을 지킨다.
-- 타인의 개인 자산에서 나가는 기록은 금지.
-- 적용 방법: Supabase 대시보드 > SQL Editor (postgres 역할) 에서 Run

create or replace function public.pay_fixed_cost_occurrence(
  p_occurrence_id uuid,
  p_paid_on date default null,
  p_record_tx boolean default false,
  p_category_id uuid default null,
  p_asset_id uuid default null,
  p_memo text default ''
)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  occ public.fixed_cost_occurrences%rowtype;
  fc public.fixed_costs%rowtype;
  v_tx_id uuid;
  v_date date;
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

  if p_record_tx then
    -- 돈이 나가는 자산(지출: 결제 수단 / 이체: 보내는 자산)의 비공개 여부 확인
    if p_asset_id is not null then
      select a.is_private, a.owner_user_id
      into v_from_private, v_from_owner
      from public.assets a
      where a.id = p_asset_id;
      if v_from_private and v_from_owner is distinct from auth.uid() then
        raise exception 'PRIVATE_ASSET_FORBIDDEN';
      end if;
    end if;

    -- 개인 자산에서 나가면 🔒 개인 거래로 기록 (가계부 프라이버시 규칙과 동일)
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
        (occ.family_id, 'transfer', fc.name, occ.amount, v_date, null,
         p_asset_id, fc.asset_id, v_member, coalesce(p_memo, ''),
         v_is_private, auth.uid())
      returning id into v_tx_id;
    else
      insert into public.transactions
        (family_id, type, title, amount, occurred_on, category_id,
         asset_id, to_asset_id, member_user_id, memo, is_private, created_by)
      values
        (occ.family_id, 'expense', fc.name, occ.amount, v_date, p_category_id,
         p_asset_id, null, v_member, coalesce(p_memo, ''),
         v_is_private, auth.uid())
      returning id into v_tx_id;
    end if;
  end if;

  update public.fixed_cost_occurrences
  set status = 'paid', paid_on = v_date, tx_id = v_tx_id
  where id = p_occurrence_id;
end;
$$;

grant execute on function
  public.pay_fixed_cost_occurrence(uuid, date, boolean, uuid, uuid, text)
  to authenticated;
