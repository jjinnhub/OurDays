"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, MailCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient, hasSupabaseEnv } from "@/lib/supabase/client";

const schema = z.object({
  email: z.string().min(1, "이메일을 입력해 주세요").email("올바른 이메일 형식이 아닙니다"),
});

type Values = z.infer<typeof schema>;

export function ForgotPasswordForm() {
  const [serverError, setServerError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: Values) {
    setServerError(null);

    if (!hasSupabaseEnv()) {
      setServerError(
        "Supabase 환경 변수가 설정되지 않았습니다. .env.local 파일을 확인해 주세요.",
      );
      return;
    }

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });

    if (error) {
      setServerError(
        error.status === 429
          ? "요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요."
          : error.message,
      );
      return;
    }

    setSentTo(values.email);
  }

  if (sentTo) {
    return (
      <div className="space-y-5 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-secondary/30">
          <MailCheck className="h-7 w-7 text-secondary-foreground" />
        </div>
        <div className="space-y-1">
          <p className="font-semibold">메일을 확인해 주세요</p>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{sentTo}</span> 이(가) 가입된
            이메일이라면 비밀번호 재설정 링크를 보내드렸어요.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          메일이 오지 않았다면 주소를 다시 확인하거나 스팸함을 살펴봐 주세요.
        </p>
        <Button asChild className="w-full">
          <Link href="/login">로그인 화면으로</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      <div className="space-y-2">
        <Label htmlFor="email">이메일</Label>
        <Input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="your@email.com"
          aria-invalid={!!errors.email}
          {...register("email")}
        />
        {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
      </div>

      {serverError && (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {serverError}
        </p>
      )}

      <Button type="submit" className="h-11 w-full text-base" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="animate-spin" />}
        재설정 링크 보내기
      </Button>

      <p className="text-center text-sm">
        <Link
          href="/login"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          로그인 페이지로 돌아가기
        </Link>
      </p>
    </form>
  );
}
