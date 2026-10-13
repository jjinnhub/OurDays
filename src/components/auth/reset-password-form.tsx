"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle2, Eye, EyeOff, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient, hasSupabaseEnv } from "@/lib/supabase/client";

const schema = z
  .object({
    password: z
      .string()
      .min(1, "새 비밀번호를 입력해 주세요")
      .min(8, "비밀번호는 8자 이상이어야 합니다")
      .regex(/[a-zA-Z]/, "영문자를 1자 이상 포함해 주세요")
      .regex(/[0-9]/, "숫자를 1자 이상 포함해 주세요"),
    passwordConfirm: z.string().min(1, "비밀번호를 한 번 더 입력해 주세요"),
  })
  .refine((v) => v.password === v.passwordConfirm, {
    path: ["passwordConfirm"],
    message: "비밀번호가 일치하지 않습니다",
  });

type Values = z.infer<typeof schema>;

type LinkState = "checking" | "valid" | "invalid";

export function ResetPasswordForm() {
  const [linkState, setLinkState] = useState<LinkState>("checking");
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // 재설정 링크(auth/callback)를 거쳐 들어오면 복구용 세션이 생긴다.
  // 세션이 없으면 만료되었거나 잘못된 접근.
  useEffect(() => {
    if (!hasSupabaseEnv()) {
      setLinkState("invalid");
      return;
    }
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setLinkState(user ? "valid" : "invalid");
    });
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", passwordConfirm: "" },
  });

  async function onSubmit(values: Values) {
    setServerError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: values.password });

    if (error) {
      setServerError(
        error.message.includes("different from the old password")
          ? "이전과 다른 비밀번호를 사용해 주세요."
          : error.message,
      );
      return;
    }

    // 재설정 완료 후에는 복구 세션을 끊고 새 비밀번호로 다시 로그인하게 한다.
    await supabase.auth.signOut();
    setDone(true);
  }

  if (linkState === "checking") {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        링크를 확인하고 있어요…
      </div>
    );
  }

  if (linkState === "invalid") {
    return (
      <div className="space-y-5 text-center">
        <div className="space-y-1">
          <p className="font-semibold">링크가 만료되었거나 올바르지 않아요</p>
          <p className="text-sm text-muted-foreground">
            비밀번호 재설정 링크는 보안을 위해 짧은 시간만 유효합니다. 링크를 다시
            요청해 주세요.
          </p>
        </div>
        <Button asChild className="w-full">
          <Link href="/forgot-password">재설정 링크 다시 받기</Link>
        </Button>
        <p className="text-center text-sm">
          <Link
            href="/login"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            로그인 페이지로 돌아가기
          </Link>
        </p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="space-y-5 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-secondary/30">
          <CheckCircle2 className="h-7 w-7 text-secondary-foreground" />
        </div>
        <div className="space-y-1">
          <p className="font-semibold">비밀번호가 변경되었어요</p>
          <p className="text-sm text-muted-foreground">
            새 비밀번호로 다시 로그인해 주세요.
          </p>
        </div>
        <Button asChild className="w-full">
          <Link href="/login">로그인하러 가기</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      <div className="space-y-2">
        <Label htmlFor="password">새 비밀번호</Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="영문, 숫자 포함 8자 이상"
            className="pr-10"
            aria-invalid={!!errors.password}
            {...register("password")}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
            aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {errors.password && (
          <p className="text-xs text-destructive">{errors.password.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="passwordConfirm">새 비밀번호 확인</Label>
        <Input
          id="passwordConfirm"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          placeholder="비밀번호를 한 번 더 입력"
          aria-invalid={!!errors.passwordConfirm}
          {...register("passwordConfirm")}
        />
        {errors.passwordConfirm && (
          <p className="text-xs text-destructive">{errors.passwordConfirm.message}</p>
        )}
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
        비밀번호 변경하기
      </Button>
    </form>
  );
}
