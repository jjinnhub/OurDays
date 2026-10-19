import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CalendarView } from "@/components/calendar/calendar-view";
import type { FamilyMemberLite } from "@/lib/asset-constants";
import type { EventRow } from "@/lib/calendar-constants";
import { getUserAndMembership } from "@/lib/family";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "캘린더" };

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { user, membership } = await getUserAndMembership();
  if (!user || !membership) redirect("/login");

  const params = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(params.month ?? "")
    ? params.month!
    : currentMonth();

  const [y, m] = month.split("-").map(Number);
  // 그리드에 보이는 앞뒤 달 포함 넉넉한 범위
  const prev = new Date(y, m - 2, 20);
  const next = new Date(y, m, 12);

  const supabase = await createClient();
  await supabase.rpc("ensure_fixed_cost_occurrences", {
    p_family_id: membership.family_id,
  });

  const [
    { data: eventRows },
    { data: memberRows },
    { data: profileRows },
    { data: fcOccRows },
    { data: canEdit },
  ] = await Promise.all([
    supabase
      .from("events")
      .select("*, event_attendees(user_id)")
      .eq("family_id", membership.family_id)
      .order("start_on", { ascending: true }),
    supabase
      .from("family_members")
      .select("user_id, display_name, color")
      .eq("family_id", membership.family_id),
    supabase.from("profiles").select("id, name, birthdate"),
    supabase
      .from("fixed_cost_occurrences")
      .select("due_on, amount, fixed_costs(name)")
      .eq("family_id", membership.family_id)
      .gte("due_on", `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}-${String(prev.getDate()).padStart(2, "0")}`)
      .lte("due_on", `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`),
    supabase.rpc("can_edit_module", {
      p_family_id: membership.family_id,
      p_module: "calendar",
    }),
  ]);

  const members = (memberRows as FamilyMemberLite[] | null) ?? [];
  const profiles =
    (profileRows as { id: string; name: string; birthdate: string | null }[] | null) ??
    [];
  const birthdays = members
    .map((m) => {
      const p = profiles.find((p) => p.id === m.user_id);
      return p?.birthdate
        ? {
            user_id: m.user_id,
            name: p.name || m.display_name,
            birthdate: p.birthdate,
            color: m.color,
          }
        : null;
    })
    .filter((b): b is NonNullable<typeof b> => b !== null);

  type FcOccRow = {
    due_on: string;
    amount: number | string;
    fixed_costs: { name: string } | null;
  };
  const fixedOccurrences = ((fcOccRows as FcOccRow[] | null) ?? []).map((o) => ({
    due_on: o.due_on,
    amount: o.amount,
    name: o.fixed_costs?.name ?? "고정비",
  }));

  return (
    <CalendarView
      familyId={membership.family_id}
      currentUserId={user.id}
      myColor={membership.color}
      month={month}
      events={(eventRows as EventRow[] | null) ?? []}
      members={members}
      birthdays={birthdays}
      fixedOccurrences={fixedOccurrences}
      canEdit={Boolean(canEdit)}
    />
  );
}
