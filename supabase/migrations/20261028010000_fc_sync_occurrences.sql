-- OurDays: 고정비 수정 시 미납 회차 동기화
-- 문제: 월 회차(fixed_cost_occurrences)는 생성 시점의 금액/납부일 스냅샷이라
--       고정비(fixed_costs)를 수정해도 이미 생성된 회차·요약 합계에 반영되지 않음.
-- 해결: 수정 트리거로 납부 완료(paid)가 아닌 회차의 금액·납부일을 따라가게 함.
-- 적용 방법: Supabase 대시보드 > SQL Editor (postgres 역할) 에서 Run

create or replace function public.sync_fixed_cost_occurrences()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.amount is distinct from old.amount
     or new.due_day is distinct from old.due_day then
    update public.fixed_cost_occurrences o
    set amount = new.amount,
        due_on = make_date(
          extract(year from o.due_on)::int,
          extract(month from o.due_on)::int,
          least(
            new.due_day,
            extract(day from (date_trunc('month', o.due_on) + interval '1 month - 1 day'))::int
          )
        )
    where o.fixed_cost_id = new.id
      and o.status <> 'paid';
  end if;
  return new;
end;
$$;

drop trigger if exists fixed_costs_sync_occurrences on public.fixed_costs;
create trigger fixed_costs_sync_occurrences
  after update on public.fixed_costs
  for each row execute function public.sync_fixed_cost_occurrences();

-- 일회성 보정: 이미 어긋나 있는 미납 회차를 현재 고정비 값에 맞춘다
update public.fixed_cost_occurrences o
set amount = fc.amount,
    due_on = make_date(
      extract(year from o.due_on)::int,
      extract(month from o.due_on)::int,
      least(
        fc.due_day,
        extract(day from (date_trunc('month', o.due_on) + interval '1 month - 1 day'))::int
      )
    )
from public.fixed_costs fc
where o.fixed_cost_id = fc.id
  and o.status <> 'paid'
  and (o.amount is distinct from fc.amount
       or extract(day from o.due_on)::int <> least(
            fc.due_day,
            extract(day from (date_trunc('month', o.due_on) + interval '1 month - 1 day'))::int
          ));
