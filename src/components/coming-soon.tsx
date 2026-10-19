import { Construction } from "lucide-react";

export function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Construction className="h-7 w-7" />
      </span>
      <h1 className="text-xl font-bold">{title}</h1>
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
