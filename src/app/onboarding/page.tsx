import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { getUserAndMembership } from "@/lib/family";
import { hasSupabaseEnv } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "가족 만들기",
};

export default async function OnboardingPage() {
  if (!hasSupabaseEnv()) redirect("/login");

  const { user, membership } = await getUserAndMembership();
  if (!user) redirect("/login");
  if (membership) redirect("/dashboard");

  const cookieStore = await cookies();
  const inviteCode = cookieStore.get("ourdays_invite_code")?.value ?? "";

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-background px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-brand-blush/40 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-28 -right-20 h-80 w-80 rounded-full bg-brand-sun/30 blur-3xl"
      />
      <div className="relative w-full">
        <OnboardingFlow initialCode={inviteCode} />
      </div>
    </main>
  );
}
