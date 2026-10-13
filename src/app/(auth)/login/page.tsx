import type { Metadata } from "next";

import { redirect } from "next/navigation";

import { BrandLogo } from "@/components/brand-logo";
import { LoginForm } from "@/components/auth/login-form";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { createClient, hasSupabaseEnv } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "로그인",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  // 이미 로그인된 상태면 홈으로 (세션 유지 중 재방문 대응)
  if (hasSupabaseEnv()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) redirect("/dashboard");
  }

  return (
    <Card className="mx-auto w-full max-w-sm">
      <CardHeader className="items-center pb-4 pt-8">
        <BrandLogo size={144} />
        <p className="pt-2 text-sm text-muted-foreground">
          우리 가족의 모든 것을 함께 기록해요
        </p>
      </CardHeader>
      <CardContent className="pb-8">
        {error && (
          <p
            role="alert"
            className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </p>
        )}
        <LoginForm />
      </CardContent>
    </Card>
  );
}
