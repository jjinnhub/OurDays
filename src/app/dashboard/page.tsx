import { redirect } from "next/navigation";

import { BrandLogo } from "@/components/brand-logo";
import { createClient, hasSupabaseEnv } from "@/lib/supabase/server";

export default async function DashboardPage() {
  if (!hasSupabaseEnv()) redirect("/login");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4">
      <BrandLogo size={96} />
      <p className="text-muted-foreground">
        <span className="font-medium text-foreground">{user.email}</span> 님, 로그인되었습니다.
      </p>
      <p className="text-sm text-muted-foreground">다음 단계에서 기능을 이어서 구축합니다.</p>
    </main>
  );
}
