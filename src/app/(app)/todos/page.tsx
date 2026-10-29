import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { TodosView } from "@/components/todos/todos-view";
import type { FamilyMemberLite } from "@/lib/asset-constants";
import type { Todo } from "@/lib/todo-constants";
import { getUserAndMembership } from "@/lib/family";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "할 일" };

export default async function TodosPage() {
  const { user, membership } = await getUserAndMembership();
  if (!user || !membership) redirect("/login");

  const supabase = await createClient();
  const [{ data: todoRows }, { data: memberRows }, { data: canEdit }] =
    await Promise.all([
      // 비공개 할 일은 RLS가 본인 것만 돌려준다
      supabase
        .from("todos")
        .select(
          "id, family_id, title, memo, assignee_user_id, due_on, is_important, is_private, created_by, done_by, done_at, created_at",
        )
        .eq("family_id", membership.family_id)
        .order("created_at", { ascending: true }),
      supabase
        .from("family_members")
        .select("user_id, display_name, color")
        .eq("family_id", membership.family_id),
      supabase.rpc("can_edit_module", {
        p_family_id: membership.family_id,
        p_module: "todos",
      }),
    ]);

  return (
    <TodosView
      familyId={membership.family_id}
      currentUserId={user.id}
      initialTodos={(todoRows as Todo[] | null) ?? []}
      members={(memberRows as FamilyMemberLite[] | null) ?? []}
      canEdit={Boolean(canEdit)}
    />
  );
}
