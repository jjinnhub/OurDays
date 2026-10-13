"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Loader2, MailCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient, hasSupabaseEnv } from "@/lib/supabase/client";

const signupSchema = z
  .object({
    name: z
      .string()
      .min(1, "이름을 입력해 주세요")
      .min(2, "이름은 2자 이상 입력해 주세요")
      .max(30, "이름은 30자 이하로 입력해 주세요"),
    birthdate: z
      .string()
      .min(1, "생년월일을 선택해 주세요")
      .refine((v) => !Number.isNaN(Date.parse(v)), "올바른 날짜가 아닙니다")
      .refine((v) => Date.parse(v) <= Date.now(), "미래 날짜는 선택할 수 없습니다")
      .refine(
        (v) => Date.parse(v) >= Date.parse("1900-01-01"),
        "1900년 이후 날짜를 선택해 주세요",
      ),
    email: z.string().min(1, "이메일을 입력해 주세요").email("올바른 이메일 형식이 아닙니다"),
    phone: z
      .string()
      .transform((v) => v.replaceAll("-", "").replaceAll(" ", ""))
      .refine(
        (v) => v === "" || /^01[016789]\d{7,8}$/.test(v),
        "올바른 휴대폰 번호가 아닙니다 (예: 010-1234-5678)",
      ),
    password: z
      .string()
      .min(1, "비밀번호를 입력해 주세요")
      .min(8, "비밀번호는 8자 이상이어야 합니다")
      .regex(/[a-zA-Z]/, "영문자를 1자 이상 포함해 주세요")
      .regex(/[0-9]/, "숫자를 1자 이상 포함해 주세요"),
    passwordConfirm: z.string().min(1, "비밀번호를 한 번 더 입력해 주세요"),
    agreeTerms: z.boolean().refine((v) => v, "서비스 이용약관에 동의해 주세요"),
    agreePrivacy: z.boolean().refine((v) => v, "개인정보 수집·이용에 동의해 주세요"),
    agreeMarketing: z.boolean(),
  })
  .refine((v) => v.password === v.passwordConfirm, {
    path: ["passwordConfirm"],
    message: "비밀번호가 일치하지 않습니다",
  });

type SignupValues = z.infer<typeof signupSchema>;

export function SignupForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent">("idle");

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: "",
      birthdate: "",
      email: "",
      phone: "",
      password: "",
      passwordConfirm: "",
      agreeTerms: false,
      agreePrivacy: false,
      agreeMarketing: false,
    },
  });

  const agreeTerms = watch("agreeTerms");
  const agreePrivacy = watch("agreePrivacy");
  const agreeMarketing = watch("agreeMarketing");
  const agreeAll = agreeTerms && agreePrivacy && agreeMarketing;

  function toggleAll(checked: boolean) {
    setValue("agreeTerms", checked, { shouldValidate: true });
    setValue("agreePrivacy", checked, { shouldValidate: true });
    setValue("agreeMarketing", checked);
  }

  async function onSubmit(values: SignupValues) {
    setServerError(null);

    if (!hasSupabaseEnv()) {
      setServerError(
        "Supabase 환경 변수가 설정되지 않았습니다. .env.local 파일을 확인해 주세요.",
      );
      return;
    }

    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: {
          name: values.name,
          birthdate: values.birthdate,
          phone: values.phone || null,
          marketing_opt_in: values.agreeMarketing,
        },
      },
    });

    if (error) {
      setServerError(
        error.message === "User already registered"
          ? "이미 가입된 이메일입니다. 로그인해 주세요."
          : error.message,
      );
      return;
    }

    // 이메일 확인이 켜진 프로젝트에서 기존 계정으로 signUp하면
    // 오류 대신 identities가 빈 사용자 객체가 돌아온다.
    if (data.user && data.user.identities?.length === 0) {
      setServerError("이미 가입된 이메일입니다. 로그인해 주세요.");
      return;
    }

    setSentTo(values.email);
  }

  async function resend() {
    if (!sentTo || resendState === "sending") return;
    setResendState("sending");
    const supabase = createClient();
    await supabase.auth.resend({ type: "signup", email: sentTo });
    setResendState("sent");
  }

  if (sentTo) {
    return (
      <div className="space-y-5 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-secondary/30">
          <MailCheck className="h-7 w-7 text-secondary-foreground" />
        </div>
        <div className="space-y-1">
          <p className="font-semibold">인증 메일을 보냈어요</p>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{sentTo}</span> 로 보낸 메일의
            링크를 눌러 가입을 완료해 주세요.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          메일이 오지 않았다면 스팸함을 확인해 주세요.
        </p>
        <div className="space-y-2">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={resend}
            disabled={resendState !== "idle"}
          >
            {resendState === "sending" && <Loader2 className="animate-spin" />}
            {resendState === "sent" ? "다시 보냈어요" : "인증 메일 다시 보내기"}
          </Button>
          <Button asChild className="w-full">
            <Link href="/login">로그인 화면으로</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="name">이름</Label>
        <Input id="name" autoComplete="name" placeholder="홍길동" aria-invalid={!!errors.name} {...register("name")} />
        {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="birthdate">생년월일</Label>
        <Input
          id="birthdate"
          type="date"
          autoComplete="bday"
          max={new Date().toISOString().slice(0, 10)}
          aria-invalid={!!errors.birthdate}
          {...register("birthdate")}
        />
        {errors.birthdate && (
          <p className="text-xs text-destructive">{errors.birthdate.message}</p>
        )}
      </div>

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
        <p className="text-xs text-muted-foreground">입력한 주소로 인증 메일이 발송됩니다.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">
          휴대폰 번호 <span className="font-normal text-muted-foreground">(선택)</span>
        </Label>
        <Input
          id="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="010-1234-5678"
          aria-invalid={!!errors.phone}
          {...register("phone")}
        />
        {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">비밀번호</Label>
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
        <Label htmlFor="passwordConfirm">비밀번호 확인</Label>
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

      <div className="space-y-3 rounded-lg border bg-muted/40 p-4">
        <div className="flex items-center gap-2">
          <Checkbox id="agreeAll" checked={agreeAll} onCheckedChange={(c) => toggleAll(c === true)} />
          <Label htmlFor="agreeAll" className="cursor-pointer font-semibold">
            전체 동의
          </Label>
        </div>
        <hr className="border-border" />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Checkbox
              id="agreeTerms"
              checked={agreeTerms}
              onCheckedChange={(c) => setValue("agreeTerms", c === true, { shouldValidate: true })}
            />
            <Label htmlFor="agreeTerms" className="cursor-pointer font-normal">
              <span className="text-primary">[필수]</span> 서비스 이용약관 동의
            </Label>
          </div>
          <Link href="/terms" target="_blank" className="text-xs text-muted-foreground underline">
            보기
          </Link>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Checkbox
              id="agreePrivacy"
              checked={agreePrivacy}
              onCheckedChange={(c) => setValue("agreePrivacy", c === true, { shouldValidate: true })}
            />
            <Label htmlFor="agreePrivacy" className="cursor-pointer font-normal">
              <span className="text-primary">[필수]</span> 개인정보 수집·이용 동의
            </Label>
          </div>
          <Link href="/privacy" target="_blank" className="text-xs text-muted-foreground underline">
            보기
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="agreeMarketing"
            checked={agreeMarketing}
            onCheckedChange={(c) => setValue("agreeMarketing", c === true)}
          />
          <Label htmlFor="agreeMarketing" className="cursor-pointer font-normal">
            <span className="text-muted-foreground">[선택]</span> 소식·혜택 알림 수신 동의
          </Label>
        </div>
        {(errors.agreeTerms || errors.agreePrivacy) && (
          <p className="text-xs text-destructive">
            {errors.agreeTerms?.message ?? errors.agreePrivacy?.message}
          </p>
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
        가입하기
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        이미 계정이 있으신가요?{" "}
        <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
          로그인
        </Link>
      </p>
    </form>
  );
}
