import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getUserAndMembership } from "@/lib/family";
import { hasSupabaseEnv } from "@/lib/supabase/server";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!hasSupabaseEnv()) redirect("/login");

  const { user, membership, profileName } = await getUserAndMembership();
  if (!user) redirect("/login");
  if (!membership) redirect("/onboarding");

  const userName = profileName || membership.display_name;

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
