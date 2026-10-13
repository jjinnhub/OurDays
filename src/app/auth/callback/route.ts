import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * Supabase 인증 콜백.
 * 가입 인증/비밀번호 재설정 메일의 code를 세션으로 교환한 뒤 앱으로 보낸다.
 *
 * 리다이렉트 주소는 request.url의 origin을 쓰지 않는다.
 * 서버가 0.0.0.0에 바인딩되면 origin이 http://0.0.0.0:3000이 되어
 * 브라우저가 접속할 수 없는 주소로 보내게 되므로,
 * 브라우저가 보낸 Host 헤더(프록시 뒤라면 x-forwarded-*)로 origin을 복원한다.
 */
function siteOrigin(request: Request): string {
  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto =
    request.headers.get("x-forwarded-proto") ??
    (host?.startsWith("localhost") || host?.startsWith("127.") ? "http" : "https");
  if (host) return `${proto}://${host}`;
  return new URL(request.url).origin;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const origin = siteOrigin(request);

  // 오픈 리다이렉트 방지: 내부 경로만 허용
  let next = searchParams.get("next") ?? "/dashboard";
  if (!next.startsWith("/") || next.startsWith("//")) next = "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent("인증에 실패했습니다. 다시 시도해 주세요.")}`,
  );
}
