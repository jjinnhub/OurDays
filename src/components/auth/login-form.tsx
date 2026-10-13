"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient, hasSupabaseEnv } from "@/lib/supabase/client";

const loginSchema = z.object({
  email: z.string().min(1, "이메일을 입력해 주세요").email("올바른 이메일 형식이 아닙니다"),
  password: z.string().min(1, "비밀번호를 입력해 주세요").min(6, "비밀번호는 6자 이상입니다"),
  remember: z.boolean(),
});

type LoginValues = z.infer<typeof loginSchema>;

const REMEMBER_KEY = "ourdays:remember-email";

function getRememberedEmail() {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(REMEMBER_KEY) ?? "";
  } catch {
    return "";
  }
}

export function LoginForm() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const rememberedEmail = getRememberedEmail();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: rememberedEmail,
      password: "",
      remember: rememberedEmail !== "",
    },
  });

  const remember = watch("remember");

  async function onSubmit(values: LoginValues) {
    setServerError(null);

    if (!hasSupabaseEnv()) {
      setServerError(
        "Supabase 환경 변수가 설정되지 않았습니다. .env.local 파일을 확인해 주세요.",
      );
      return;
    }

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });

    if (error) {
      setServerError(
        error.message === "Invalid login credentials"
          ? "이메일 또는 비밀번호가 올바르지 않습니다."
          : error.message,
      );
      return;
    }

    try {
      if (values.remember) {
        window.localStorage.setItem(REMEMBER_KEY, values.email);
      } else {
        window.localStorage.removeItem(REMEMBER_KEY);
      }
    } catch {
      // localStorage 사용 불가 환경은 무시
    }

    router.replace("/dashboard");
    router.refresh();
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
        {errors.email && (
          <p className="text-xs text-destructive">{errors.email.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">비밀번호</Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="••••••••"
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

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Checkbox
            id="remember"
            checked={remember}
            onCheckedChange={(checked) => setValue("remember", checked === true)}
          />
          <Label htmlFor="remember" className="cursor-pointer font-normal">
            로그인 상태 유지
          </Label>
        </div>
        <Link
          href="/forgot-password"
          className="text-sm text-primary underline-offset-4 hover:underline"
        >
          비밀번호 찾기
        </Link>
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
        로그인
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        아직 계정이 없으신가요?{" "}
        <Link href="/signup" className="font-medium text-primary underline-offset-4 hover:underline">
          가입하기
        </Link>
      </p>
    </form>
  );
}
