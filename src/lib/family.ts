import { cache } from "react";

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

/**
 * 현재 로그인 사용자와 (있다면) 첫 번째 가족 멤버십, 프로필 이름을 가져온다.
 * React cache로 요청 단위 중복 호출을 제거한다 — 레이아웃과 페이지가 결과를 공유.
 */
export const getUserAndMembership = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { user: null, membership: null, profileName: null };

  const [{ data }, { data: profile }] = await Promise.all([
    supabase
      .from("family_members")
      .select(
        "family_id, role, display_name, color, families(name, invite_code, invite_expires_at)",
      )
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle(),
    supabase.from("profiles").select("name").eq("id", user.id).maybeSingle(),
  ]);

  return {
    user,
    membership: (data as Membership | null) ?? null,
    profileName: (profile as { name: string } | null)?.name ?? null,
  };
});
