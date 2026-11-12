-- OurDays: 월 예산 납부 체크 → 가계부 기록 연동
-- 항목 유형(지출/이체)을 추가하고, 납부 완료 시 가계부 거래를 생성·연결한다.
-- 해제 시 연결된 거래를 삭제해 자산 잔액까지 원복한다.
-- 적용 방법: Supabase 대시보드 > SQL Editor (postgres 역할) 에서 Run

-- 1) 고정비 유형(지출/이체) + 이체용 보내는 자산
alter table public.fixed_costs
  add column if not exists tx_type text not null default 'expense'
    check (tx_type in ('expense', 'transfer'));
alter table public.fixed_costs
  add column if not exists from_asset_id uuid
    references public.assets(id) on delete set null;

-- 2) 회차 ↔ 가계부 거래 연결 (거래가 지워지면 연결만 해제)
alter table public.fixed_cost_occurrences
  add column if not exists tx_id uuid
    references public.transactions(id) on delete set null;

-- 3) 납부 완료 RPC — 가계부 기록 옵션 포함
drop function if exists public.pay_fixed_cost_occurrence(uuid, date);
drop function if exists public.pay_fixed_cost_occurrence(uuid);

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
    if fc.tx_type = 'transfer' then
      -- 이체: 보내는 자산(p_asset_id) -> 분배 자산(fc.asset_id)
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
         p_asset_id, fc.asset_id, fc.member_user_id, coalesce(p_memo, ''),
         fc.is_private, auth.uid())
      returning id into v_tx_id;
    else
      -- 지출: 결제 수단 = p_asset_id (없으면 자산 미지정 지출)
      insert into public.transactions
        (family_id, type, title, amount, occurred_on, category_id,
         asset_id, to_asset_id, member_user_id, memo, is_private, created_by)
      values
        (occ.family_id, 'expense', fc.name, occ.amount, v_date, p_category_id,
         p_asset_id, null, fc.member_user_id, coalesce(p_memo, ''),
         fc.is_private, auth.uid())
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

-- 4) 납부 해제 RPC — 연결된 가계부 거래를 삭제해 잔액 원복
drop function if exists public.unpay_fixed_cost_occurrence(uuid);

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
