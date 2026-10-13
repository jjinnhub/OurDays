"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Copy,
  Home,
  Loader2,
  PartyPopper,
  Ticket,
  Users,
} from "lucide-react";

import { BrandLogo } from "@/components/brand-logo";
import { ColorPalette } from "@/components/color-palette";
import { DisplayNameSelect } from "@/components/display-name-select";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MEMBER_COLORS } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";

type Step =
  | "choice"
  | "create-name"
  | "join-code"
  | "join-preview"
  | "profile"
  | "create-done";

type Preview = { name: string; member_count: number; used_colors?: string[] };
type CreateResult = { invite_code: string; invite_expires_at: string };

function rpcErrorMessage(message: string): string {
  if (message.includes("RATE_LIMITED"))
    return "시도가 너무 잦습니다. 1분 뒤에 다시 시도해 주세요.";
  if (message.includes("INVALID_CODE"))
    return "유효하지 않거나 만료된 초대코드입니다.";
  return message;
}

export function OnboardingFlow({ initialCode }: { initialCode: string }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(initialCode ? "join-code" : "choice");
  const [mode, setMode] = useState<"create" | "join">(initialCode ? "join" : "create");

  const [familyName, setFamilyName] = useState("");
  const [code, setCode] = useState(initialCode.slice(0, 6));
  const [preview, setPreview] = useState<Preview | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [color, setColor] = useState<string>(
    MEMBER_COLORS[Math.floor(Math.random() * MEMBER_COLORS.length)],
  );
  const [created, setCreated] = useState<CreateResult | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<"code" | "link" | null>(null);

  function go(next: Step) {
    setError(null);
    setStep(next);
  }

  async function fetchPreview() {
    if (code.trim().length !== 6) {
      setError("초대코드 6자리를 입력해 주세요.");
      return;
    }
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { data, error: rpcError } = await supabase.rpc("preview_family_by_code", {
      p_code: code.trim(),
    });
    setLoading(false);

    if (rpcError) {
      setError(rpcErrorMessage(rpcError.message));
      return;
    }
    if (!data) {
      setError("유효하지 않거나 만료된 초대코드입니다.");
      return;
    }
    const p = data as Preview;
    setPreview(p);
    const used = p.used_colors ?? [];
    if (used.includes(color)) {
      const free = MEMBER_COLORS.find((c) => !used.includes(c));
      if (free) setColor(free);
    }
    go("join-preview");
  }

  async function submitProfile() {
    if (displayName.trim().length === 0) {
      setError("호칭을 선택해 주세요.");
      return;
    }
    setLoading(true);
    setError(null);
    const supabase = createClient();

    if (mode === "create") {
      const { data, error: rpcError } = await supabase.rpc("create_family", {
        p_family_name: familyName.trim(),
        p_display_name: displayName.trim(),
        p_color: color,
      });
      setLoading(false);
      if (rpcError) {
        setError(rpcErrorMessage(rpcError.message));
        return;
      }
      setCreated(data as CreateResult);
      go("create-done");
      return;
    }

    if ((preview?.used_colors ?? []).includes(color)) {
      setLoading(false);
      setError("기존 구성원이 사용 중인 색상이에요. 다른 색상을 선택해 주세요.");
      return;
    }
    const { error: rpcError } = await supabase.rpc("join_family_by_code", {
      p_code: code.trim(),
      p_display_name: displayName.trim(),
      p_color: color,
    });
    setLoading(false);
    if (rpcError) {
      setError(rpcErrorMessage(rpcError.message));
      return;
    }
    router.replace("/dashboard");
    router.refresh();
  }

  async function copy(text: string, kind: "code" | "link") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // clipboard 미지원 환경은 무시
    }
  }

  // ---------- 단계별 화면 ----------

  if (step === "choice") {
    return (
      <Card className="mx-auto w-full max-w-md">
        <CardHeader className="items-center pb-2 pt-8 text-center">
          <BrandLogo size={112} showWordmark={false} />
          <CardTitle className="text-xl">아직 가족이 없어요 😭</CardTitle>
          <CardDescription>
            OurDays는 가족 단위로 일정과 가계를 함께 기록해요.
            <br />
            가족을 만들거나, 받은 초대코드로 참가해 주세요.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 pb-8 pt-4">
          <button
            type="button"
            onClick={() => {
              setMode("create");
              go("create-name");
            }}
            className="flex w-full items-center gap-4 rounded-xl border bg-card p-4 text-left shadow-sm transition-colors hover:border-primary/50 hover:bg-muted/50"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Home className="h-5 w-5" />
            </span>
            <span>
              <span className="block font-semibold">가족 만들기</span>
              <span className="block text-sm text-muted-foreground">
                새 가족 공간을 만들어요. 혼자 시작해도 괜찮아요.
              </span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("join");
              go("join-code");
            }}
            className="flex w-full items-center gap-4 rounded-xl border bg-card p-4 text-left shadow-sm transition-colors hover:border-primary/50 hover:bg-muted/50"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-secondary/20 text-secondary-foreground">
              <Ticket className="h-5 w-5" />
            </span>
            <span>
              <span className="block font-semibold">가족 참가하기</span>
              <span className="block text-sm text-muted-foreground">
                가족에게 받은 초대코드를 입력해요.
              </span>
            </span>
          </button>
        </CardContent>
      </Card>
    );
  }

  if (step === "create-name") {
    return (
      <Card className="mx-auto w-full max-w-md">
        <CardHeader className="pb-4 pt-8">
          <CardTitle className="text-xl">가족 이름 정하기</CardTitle>
          <CardDescription>
            우리 가족 공간의 이름이에요. 나중에 바꿀 수 있어요.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 pb-8">
          <div className="space-y-2">
            <Label htmlFor="familyName">가족 이름</Label>
            <Input
              id="familyName"
              placeholder="예: 김씨네, 우리집"
              maxLength={30}
              value={familyName}
              onChange={(e) => setFamilyName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && familyName.trim()) go("profile");
              }}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={() => go("choice")} aria-label="뒤로">
              <ArrowLeft />
            </Button>
            <Button
              className="h-10 flex-1"
              disabled={!familyName.trim()}
              onClick={() => go("profile")}
            >
              다음
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (step === "join-code") {
    return (
      <Card className="mx-auto w-full max-w-md">
        <CardHeader className="pb-4 pt-8">
          <CardTitle className="text-xl">초대코드 입력</CardTitle>
          <CardDescription>
            가족에게 받은 6자리 초대코드를 입력해 주세요.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 pb-8">
          <div className="space-y-2">
            <Label htmlFor="inviteCode">초대코드</Label>
            <Input
              id="inviteCode"
              placeholder="ABC123"
              maxLength={6}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              className="text-center text-xl font-semibold tracking-[0.4em]"
              value={code}
              onChange={(e) =>
                setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") fetchPreview();
              }}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={() => go("choice")} aria-label="뒤로">
              <ArrowLeft />
            </Button>
            <Button
              className="h-10 flex-1"
              disabled={loading || code.length !== 6}
              onClick={fetchPreview}
            >
              {loading && <Loader2 className="animate-spin" />}
              가족 찾기
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (step === "join-preview" && preview) {
    return (
      <Card className="mx-auto w-full max-w-md">
        <CardHeader className="items-center pb-4 pt-8 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary/20 text-secondary-foreground">
            <Users className="h-7 w-7" />
          </span>
          <CardTitle className="text-xl">이 가족에 참가할까요?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 pb-8">
          <div className="rounded-xl border bg-muted/40 p-4 text-center">
            <p className="text-lg font-semibold">{preview.name}</p>
            <p className="text-sm text-muted-foreground">
              현재 구성원 {preview.member_count}명
            </p>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => go("join-code")}
              aria-label="뒤로"
            >
              <ArrowLeft />
            </Button>
            <Button className="h-10 flex-1" onClick={() => go("profile")}>
              네, 참가할게요
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (step === "profile") {
    return (
      <Card className="mx-auto w-full max-w-md">
        <CardHeader className="pb-4 pt-8">
          <CardTitle className="text-xl">
            {mode === "create" ? `'${familyName.trim()}'에서` : `'${preview?.name}'에서`} 어떻게
            불릴까요?
          </CardTitle>
          <CardDescription>
            호칭과 색상은 캘린더와 가계부에서 구성원을 구분하는 데 쓰여요.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 pb-8">
          <div className="space-y-2">
            <Label>호칭</Label>
            <DisplayNameSelect value={displayName} onChange={setDisplayName} />
          </div>
          <div className="space-y-2">
            <Label>내 색상</Label>
            <ColorPalette
              value={color}
              onChange={setColor}
              usedColors={mode === "join" ? preview?.used_colors ?? [] : []}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => go(mode === "create" ? "create-name" : "join-preview")}
              aria-label="뒤로"
            >
              <ArrowLeft />
            </Button>
            <Button
              className="h-10 flex-1"
              disabled={loading || !displayName.trim()}
              onClick={submitProfile}
            >
              {loading && <Loader2 className="animate-spin" />}
              {mode === "create" ? "가족 만들기" : "참가하기"}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (step === "create-done" && created) {
    const inviteLink =
      typeof window !== "undefined"
        ? `${window.location.origin}/invite/${created.invite_code}`
        : "";
    const expires = new Date(created.invite_expires_at).toLocaleDateString("ko-KR", {
      month: "long",
      day: "numeric",
    });

    return (
      <Card className="mx-auto w-full max-w-md">
        <CardHeader className="items-center pb-4 pt-8 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/30 text-accent-foreground">
            <PartyPopper className="h-7 w-7" />
          </span>
          <CardTitle className="text-xl">가족이 만들어졌어요!</CardTitle>
          <CardDescription>
            아래 초대코드를 가족에게 공유하면 함께 쓸 수 있어요. ({expires}까지 유효)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pb-8">
          <div className="rounded-xl border bg-muted/40 p-5 text-center">
            <p className="text-3xl font-bold tracking-[0.3em]">{created.invite_code}</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              onClick={() => copy(created.invite_code, "code")}
            >
              {copied === "code" ? <Check /> : <Copy />}
              {copied === "code" ? "복사됨" : "코드 복사"}
            </Button>
            <Button variant="outline" onClick={() => copy(inviteLink, "link")}>
              {copied === "link" ? <Check /> : <Copy />}
              {copied === "link" ? "복사됨" : "링크 복사"}
            </Button>
          </div>
          <Button
            className="h-11 w-full text-base"
            onClick={() => {
              router.replace("/dashboard");
              router.refresh();
            }}
          >
            대시보드로 가기
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            초대코드는 나중에 대시보드에서도 확인할 수 있어요.
          </p>
        </CardContent>
      </Card>
    );
  }

  return null;
}
