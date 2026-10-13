import { createClient } from "@/lib/supabase/server";

export type Membership = {
  family_id: string;
  role: string;
  display_name: string;
  color: string;
  families: {
    name: string;
    invite_code: string;
    invite_expires_at: string;
  };
};

/** 현재 로그인 사용자와 (있다면) 첫 번째 가족 멤버십을 가져온다. */
export async function getUserAndMembership() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { user: null, membership: null };

  const { data } = await supabase
    .from("family_members")
    .select(
      "family_id, role, display_name, color, families(name, invite_code, invite_expires_at)",
    )
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  return { user, membership: (data as Membership | null) ?? null };
}
