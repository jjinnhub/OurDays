import Image from "next/image";

import { cn } from "@/lib/utils";

type BrandLogoProps = {
  size?: number;
  showWordmark?: boolean;
  className?: string;
};

export function BrandLogo({ size = 96, showWordmark = true, className }: BrandLogoProps) {
  return (
    <div className={cn("flex flex-col items-center", className)}>
      <Image
        src="/images/logo.png"
        alt="OurDays 로고"
        width={size}
        height={Math.round(size * (552 / 771))}
        priority
        className="select-none"
      />
      {showWordmark && (
        <span className="text-3xl font-bold tracking-tight text-brand-coral">
          OurDays
        </span>
      )}
    </div>
  );
}
