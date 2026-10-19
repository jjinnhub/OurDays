import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getUserAndMembership } from "@/lib/family";
import { createClient, hasSupabaseEnv } from "@/lib/supabase/server";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!hasSupabaseEnv()) redirect("/login");

  const { user, membership } = await getUserAndMembership();
  if (!user) redirect("/login");
  if (!membership) redirect("/onboarding");

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("name")
    .eq("id", user.id)
    .maybeSingle();
  const userName =
    (profile as { name: string } | null)?.name || membership.display_name;

  return (
    <AppShell
      familyName={membership.families.name}
      userName={userName}
      color={membership.color}
    >
      {children}
    </AppShell>
  );
}
