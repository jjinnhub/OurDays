import type { Metadata } from "next";

import { BrandLogo } from "@/components/brand-logo";
import { SignupForm } from "@/components/auth/signup-form";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "회원가입",
};

export default function SignupPage() {
  return (
    <Card className="mx-auto w-full max-w-sm">
      <CardHeader className="items-center pb-4 pt-8">
        <BrandLogo size={112} />
        <p className="pt-2 text-sm text-muted-foreground">
          가족과 함께 쓸 계정을 만들어요
        </p>
      </CardHeader>
      <CardContent className="pb-8">
        <SignupForm />
      </CardContent>
    </Card>
  );
}
