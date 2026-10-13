import type { Metadata } from "next";

import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = {
  title: "비밀번호 재설정",
};

export default function ForgotPasswordPage() {
  return (
    <Card className="mx-auto w-full max-w-xl">
      <CardHeader className="pb-6 pt-8">
        <CardTitle className="text-2xl">비밀번호 재설정</CardTitle>
        <CardDescription>
          가입하신 이메일 주소를 입력하시면 비밀번호 재설정 링크를 보내드립니다.
        </CardDescription>
      </CardHeader>
      <CardContent className="pb-8">
        <ForgotPasswordForm />
      </CardContent>
    </Card>
  );
}
