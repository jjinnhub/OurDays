import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function Widget({
  title,
  action,
  className,
  children,
}: {
  title: string;
  action?: { label: string; href: string };
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader className="px-4 pb-1.5 pt-3.5">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-2 px-4 pb-3.5 pt-0">
        <div className="flex-1">{children}</div>
        {action && (
          <Button asChild variant="outline" size="sm" className="h-8 w-full">
            <Link href={action.href}>{action.label}</Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export function WidgetEmpty({
  icon,
  message,
}: {
  icon: React.ReactNode;
  message: string;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1.5 py-3 text-center">
      <span className="text-muted-foreground/60">{icon}</span>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
