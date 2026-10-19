import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { MessagesView } from "@/components/messages/messages-view";
import type { FamilyMemberLite } from "@/lib/asset-constants";
import type { Message, MessageRead } from "@/lib/message-constants";
import { getUserAndMembership } from "@/lib/family";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "메시지" };

export default async function MessagesPage() {
  const { user, membership } = await getUserAndMembership();
  if (!user || !membership) redirect("/login");

  const supabase = await createClient();
  const [{ data: messageRows }, { data: readRows }, { data: memberRows }] =
    await Promise.all([
      supabase
        .from("messages")
        .select("id, sender_id, recipient_id, content, edited, created_at")
        .eq("family_id", membership.family_id)
        .order("created_at", { ascending: true })
        .limit(1000),
      supabase
        .from("message_reads")
        .select("peer_id, last_read_at")
        .eq("family_id", membership.family_id)
        .eq("user_id", user.id),
      supabase
        .from("family_members")
        .select("user_id, display_name, color")
        .eq("family_id", membership.family_id),
    ]);

  return (
    <MessagesView
      familyId={membership.family_id}
      familyName={membership.families.name}
      currentUserId={user.id}
      members={(memberRows as FamilyMemberLite[] | null) ?? []}
      initialMessages={(messageRows as Message[] | null) ?? []}
      initialReads={(readRows as MessageRead[] | null) ?? []}
    />
  );
}
