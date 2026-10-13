import type { Metadata } from "next";

import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = {
  title: "새 비밀번호 설정",
};

export default function ResetPasswordPage() {
  return (
    <Card className="mx-auto w-full max-w-xl">
      <CardHeader className="pb-6 pt-8">
        <CardTitle className="text-2xl">새 비밀번호 설정</CardTitle>
        <CardDescription>
          새로 사용할 비밀번호를 입력해 주세요.
        </CardDescription>
      </CardHeader>
      <CardContent className="pb-8">
        <ResetPasswordForm />
      </CardContent>
    </Card>
  );
}
