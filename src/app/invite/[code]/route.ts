import { NextResponse, type NextRequest } from "next/server";

/**
 * 초대 링크 진입점. 코드를 쿠키(10분)에 보관하고 온보딩으로 보낸다.
 * 로그인/가입을 거쳐도 쿠키가 남아 있어 코드가 자동 입력된다.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const response = NextResponse.redirect(new URL("/onboarding", request.url));
  response.cookies.set("ourdays_invite_code", code.toUpperCase().slice(0, 12), {
    maxAge: 60 * 10,
    path: "/",
    sameSite: "lax",
  });
  return response;
}
